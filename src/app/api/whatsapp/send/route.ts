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
  }
  const { conversationId } = body
  const text = body.text?.trim()
  const isMedia = !!body.mediaBase64 && !!body.mediaType

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
    return NextResponse.json({ error: 'Não foi possível conectar à Evolution API', detail: String(err) }, { status: 502 })
  }

  if (!sendRes.ok) {
    const errBody = await sendRes.text()
    console.error('[send] Evolution API retornou erro', sendRes.status, '|', endpoint, '|', errBody)
    return NextResponse.json(
      { error: `Evolution API ${sendRes.status}`, detail: errBody },
      { status: 502 }
    )
  }

  const sendData = await sendRes.json().catch(() => ({})) as Record<string, unknown>
  const waMessageId = (sendData.key as Record<string, unknown>)?.id as string | undefined

  const now = new Date().toISOString()
  const msgBody = text ?? body.caption ?? (isMedia ? '[mídia]' : '')

  // Salvar mensagem no banco
  const { data: inserted } = await supabase
    .from('crm_messages')
    .insert({
      conversation_id: conversationId,
      inbox_id: conv.inbox_id,
      wa_message_id: waMessageId ?? null,
      direction: 'outbound',
      body: msgBody,
      media_type: isMedia ? (body.mediaType ?? null) : null,
      status: 'sent',
      sent_by: user.id,
    })
    .select('id')
    .single()

  // Atualizar last_message na conversa
  await supabase
    .from('crm_conversations')
    .update({ last_message: msgBody, last_message_at: now, unread_count: 0 })
    .eq('id', conversationId)

  // Notifica clientes SSE conectados
  emitInboxEvent({ inboxId: conv.inbox_id, conversationId })

  return NextResponse.json({ ok: true, messageId: inserted?.id ?? null })
}
