import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { emitInboxEvent } from '@/lib/realtime-bus'

export const runtime = 'nodejs'

// Evolution API v2 expects raw base64, not the data URL prefix
function stripDataUrl(dataUrl: string | undefined): string {
  return dataUrl?.replace(/^data:[^;]+;base64,/, '') ?? ''
}

function buildEvolutionRequest(opts: {
  evolutionUrl: string; waInstance: string; number: string
  text?: string; isMedia: boolean
  mediaBase64?: string; mediaType?: string; fileName?: string; caption?: string
}): { endpoint: string; sendBody: Record<string, unknown> } {
  const { evolutionUrl, waInstance, number } = opts

  if (!opts.isMedia) {
    return {
      endpoint: `${evolutionUrl}/message/sendText/${waInstance}`,
      sendBody: { number, text: opts.text },
    }
  }

  const mt = opts.mediaType ?? ''
  const raw = stripDataUrl(opts.mediaBase64)

  if (mt.startsWith('audio/')) {
    return {
      endpoint: `${evolutionUrl}/message/sendWhatsAppAudio/${waInstance}`,
      sendBody: { number, encoding: true, audio: raw },
    }
  }

  const mediatype = mt.startsWith('image/') ? 'image' : mt.startsWith('video/') ? 'video' : 'document'
  return {
    endpoint: `${evolutionUrl}/message/sendMedia/${waInstance}`,
    sendBody: {
      number,
      mediatype,
      mimetype: mt,
      media: raw,
      ...(opts.caption ? { caption: opts.caption } : {}),
      ...(opts.fileName ? { fileName: opts.fileName } : {}),
    },
  }
}

export async function POST(req: NextRequest) {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    conversationId: string
    text?: string
    mediaBase64?: string
    mediaType?: string
    fileName?: string
    caption?: string
    clientRef?: string
  }
  const { conversationId } = body
  const text = body.text?.trim()
  const isMedia = !!body.mediaBase64 && !!body.mediaType
  // Idempotência: mesmo clientRef nunca gera dois envios reais pro WhatsApp,
  // mesmo que o client reenvie a chamada (retry manual usa um clientRef novo).
  const clientRef = body.clientRef ?? crypto.randomUUID()

  if (!conversationId || (!text && !isMedia)) {
    return NextResponse.json({ error: 'conversationId e text ou mídia são obrigatórios' }, { status: 400 })
  }

  // base64 tem overhead de ~33%; 20MB raw ≈ 26MB base64
  const approxBytes = Math.round((body.mediaBase64?.length ?? 0) * 0.75)
  if (approxBytes > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'Arquivo muito grande. Limite: 20 MB' }, { status: 413 })
  }

  const supabase = createServiceClient()

  // Buscar conversa + inbox
  const { data: conv, error: convErr } = await supabase
    .from('crm_conversations')
    .select('id, wa_jid, inbox_id, crm_inboxes(wa_instance)')
    .eq('id', conversationId)
    .single()

  if (convErr || !conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const inbox = conv.crm_inboxes as { wa_instance: string } | null
  if (!inbox) return NextResponse.json({ error: 'Inbox not found' }, { status: 404 })

  const evolutionUrl = process.env.EVOLUTION_API_URL
  const evolutionKey = process.env.EVOLUTION_API_KEY
  if (!evolutionUrl || !evolutionKey) {
    return NextResponse.json({ error: 'Evolution API not configured' }, { status: 500 })
  }

  const now = new Date().toISOString()
  const msgBody = text ?? body.caption ?? (isMedia ? '[mídia]' : '')

  // ─── Idempotência: já existe uma tentativa com esse clientRef? ───────────
  // Filtra também por conversation_id — client_ref já é suficiente pra
  // idempotência sozinho, mas isso evita que qualquer dessincronia de estado
  // no client (ex: retry disparado após trocar de conversa) reaproveite a
  // linha errada usando a instância/número da conversa atual.
  const { data: existing } = await supabase
    .from('crm_messages')
    .select('id, status, wa_message_id, created_at')
    .eq('client_ref', clientRef)
    .eq('conversation_id', conversationId)
    .maybeSingle()

  let rowId: string
  if (existing) {
    if (existing.status === 'sent' || existing.status === 'delivered' || existing.status === 'read') {
      // Já foi enviada de verdade — não reenviar ao WhatsApp
      return NextResponse.json({ ok: true, messageId: existing.id })
    }
    if (existing.status === 'pending') {
      // Se já tem wa_message_id, a tentativa anterior conseguiu enviar e só
      // não chegou a gravar o status final (processo caiu no meio) — isso é
      // prova de que já foi enviada; marcar como sent sem reenviar, em vez
      // de assumir falha e arriscar duplicar a mensagem pro contato real.
      if (existing.wa_message_id) {
        await supabase.from('crm_messages').update({ status: 'sent' }).eq('id', existing.id)
        return NextResponse.json({ ok: true, messageId: existing.id })
      }
      const ageMs = Date.now() - new Date(existing.created_at).getTime()
      if (ageMs < 15_000) {
        return NextResponse.json({ error: 'Envio já em andamento', retryable: false }, { status: 409 })
      }
      // pending "morto" (processo anterior nunca respondeu, sem wa_message_id) — tenta de novo reaproveitando a mesma linha
    }
    rowId = existing.id
    await supabase.from('crm_messages').update({ status: 'pending', wa_message_id: null }).eq('id', rowId)
  } else {
    // Insere como pending ANTES de chamar a Evolution — sobrevive a reload e
    // dá o estado "enviando..." imediato na tela via SSE.
    const { data: inserted, error: insertErr } = await supabase
      .from('crm_messages')
      .insert({
        conversation_id: conversationId,
        inbox_id: conv.inbox_id,
        direction: 'outbound',
        body: msgBody,
        media_type: isMedia ? (body.mediaType ?? null) : null,
        status: 'pending',
        sent_by: user.id,
        client_ref: clientRef,
      })
      .select('id')
      .single()
    if (insertErr || !inserted) {
      console.error('[send] falha ao inserir mensagem pendente:', insertErr?.message)
      return NextResponse.json({ error: 'Falha ao registrar mensagem', retryable: true }, { status: 500 })
    }
    rowId = inserted.id
  }

  emitInboxEvent({ type: 'message', inboxId: conv.inbox_id, conversationId })

  // Evolution API espera apenas os dígitos, sem o sufixo @s.whatsapp.net
  const number = conv.wa_jid.split('@')[0].replace(/\D/g, '')

  const { endpoint, sendBody } = buildEvolutionRequest({
    evolutionUrl, waInstance: inbox.wa_instance, number,
    text, isMedia,
    mediaBase64: body.mediaBase64, mediaType: body.mediaType,
    fileName: body.fileName, caption: body.caption,
  })

  // Enviar mensagem via Evolution API
  let sendRes: Response
  try {
    sendRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
      body: JSON.stringify(sendBody),
    })
  } catch (err) {
    console.error('[send] falha de rede ao chamar Evolution API:', endpoint, err)
    await supabase.from('crm_messages').update({ status: 'failed' }).eq('id', rowId)
    emitInboxEvent({ type: 'message', inboxId: conv.inbox_id, conversationId })
    // Falha antes de qualquer resposta — pode não ter sido enviada de fato, retryable
    return NextResponse.json(
      { error: 'Não foi possível conectar à Evolution API', detail: String(err), retryable: true, messageId: rowId },
      { status: 502 }
    )
  }

  if (!sendRes.ok) {
    const errBody = await sendRes.text()
    console.error('[send] Evolution API retornou erro', sendRes.status, '|', endpoint, '|', errBody)
    await supabase.from('crm_messages').update({ status: 'failed' }).eq('id', rowId)
    emitInboxEvent({ type: 'message', inboxId: conv.inbox_id, conversationId })
    return NextResponse.json(
      { error: `Evolution API ${sendRes.status}`, detail: errBody, retryable: sendRes.status >= 500, messageId: rowId },
      { status: 502 }
    )
  }

  const sendData = await sendRes.json().catch(() => ({})) as Record<string, unknown>
  const waMessageId = (sendData.key as Record<string, unknown>)?.id as string | undefined

  await supabase
    .from('crm_messages')
    .update({ status: 'sent', wa_message_id: waMessageId ?? null })
    .eq('id', rowId)

  // Atualizar last_message na conversa
  await supabase
    .from('crm_conversations')
    .update({ last_message: msgBody, last_message_at: now, unread_count: 0 })
    .eq('id', conversationId)

  // Notifica clientes SSE conectados
  emitInboxEvent({ type: 'message', inboxId: conv.inbox_id, conversationId })

  return NextResponse.json({ ok: true, messageId: rowId })
}
