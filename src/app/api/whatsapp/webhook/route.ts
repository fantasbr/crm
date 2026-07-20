import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { maybeRouteToAI } from '@/lib/ai-agent'
import { emitInboxEvent } from '@/lib/realtime-bus'
import { fetchWhatsAppAvatarUrl } from '@/lib/evolution'

export const runtime = 'nodejs'

function normalizePhone(jid: string): string {
  // "5562999991111@s.whatsapp.net" → "5562999991111"
  return jid.split('@')[0].replace(/\D/g, '')
}

type MediaInfo = { body: string; mediaType: string | null; mediaUrl: string | null }

function extractMediaInfo(msg: Record<string, unknown>): MediaInfo {
  const message = msg.message as Record<string, unknown> | undefined
  // send.message coloca mediaUrl dentro de message; messages.upsert coloca no topo
  const s3Url = (msg.mediaUrl as string | undefined) ?? null

  if (!message) return { body: '[mídia]', mediaType: null, mediaUrl: null }
  if (message.conversation) return { body: message.conversation as string, mediaType: null, mediaUrl: null }

  const ext = message.extendedTextMessage as Record<string, unknown> | undefined
  if (ext?.text) return { body: ext.text as string, mediaType: null, mediaUrl: null }

  // send.message coloca mediaUrl dentro de message; messages.upsert coloca no topo
  const mediaUrl = s3Url ?? (message.mediaUrl as string | undefined) ?? null

  type M = { url?: string; mimetype?: string; caption?: string; fileName?: string }

  if (message.imageMessage) {
    const m = message.imageMessage as M
    return { body: m.caption || '[Imagem]', mediaType: m.mimetype ?? 'image/jpeg', mediaUrl }
  }
  if (message.videoMessage) {
    const m = message.videoMessage as M
    return { body: m.caption || '[Vídeo]', mediaType: m.mimetype ?? 'video/mp4', mediaUrl }
  }
  if (message.audioMessage || message.pttMessage) {
    const m = ((message.audioMessage ?? message.pttMessage) as M | undefined) ?? {}
    return { body: '[Áudio]', mediaType: m.mimetype ?? 'audio/ogg', mediaUrl }
  }
  if (message.documentMessage) {
    const m = message.documentMessage as M
    return {
      body: m.fileName ? `[Documento: ${m.fileName}]` : '[Documento]',
      mediaType: m.mimetype ?? 'application/octet-stream',
      mediaUrl,
    }
  }
  if (message.stickerMessage) {
    const m = message.stickerMessage as M
    return { body: '[Sticker]', mediaType: m.mimetype ?? 'image/webp', mediaUrl }
  }

  // Wrappers: tipos que encapsulam outro tipo de mensagem internamente
  // Ex: viewOnceMessage { message: { imageMessage: {...} } }
  const wrapperKeys = [
    'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension',
    'documentWithCaptionMessage', 'ephemeralMessage',
  ]
  for (const key of wrapperKeys) {
    if (message[key]) {
      const inner = (message[key] as Record<string, unknown>).message as Record<string, unknown> | undefined
      if (inner) return extractMediaInfo({ ...msg, message: inner })
    }
  }

  // Tipos sem mídia — label legível
  if (message.locationMessage)
    return { body: '[Localização]', mediaType: null, mediaUrl: null }
  if (message.liveLocationMessage)
    return { body: '[Localização em tempo real]', mediaType: null, mediaUrl: null }
  if (message.contactMessage || message.contactsArrayMessage)
    return { body: '[Contato]', mediaType: null, mediaUrl: null }
  if (message.pollCreationMessage)
    return { body: '[Enquete]', mediaType: null, mediaUrl: null }
  if (message.reactionMessage) {
    const emoji = ((message.reactionMessage as Record<string, unknown>).text as string | undefined)?.trim()
    return { body: emoji ? `[Reação: ${emoji}]` : '[Reação]', mediaType: null, mediaUrl: null }
  }

  return { body: '[mídia]', mediaType: null, mediaUrl: null }
}

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const event = payload.event as string
  const instanceName = payload.instance as string

  if (!event || !instanceName) return NextResponse.json({ ok: true })

  const supabase = createServiceClient()

  // Identificar o inbox pela instância
  const { data: inbox, error: inboxError } = await supabase
    .from('crm_inboxes')
    .select('*')
    .eq('wa_instance', instanceName)
    .eq('active', true)
    .single()

  if (!inbox) {
    console.warn('[webhook] inbox não encontrado para instance:', instanceName, inboxError?.message)
    return NextResponse.json({ ok: true })
  }
  console.log('[webhook] event:', event, '| inbox:', inbox.name, '| instance:', instanceName)

  // Marca uma mensagem já existente como apagada, pelo wa_message_id — usado
  // tanto pelo REVOKE via protocolMessage quanto pelo evento messages.delete
  // (a Evolution manda os dois dependendo da versão/forma de exclusão).
  const markMessageDeleted = async (waMessageId: string) => {
    const { data: existingMsg } = await supabase
      .from('crm_messages')
      .select('id, conversation_id')
      .eq('wa_message_id', waMessageId)
      .maybeSingle()
    if (existingMsg) {
      await supabase.from('crm_messages').update({ deleted_at: new Date().toISOString() }).eq('id', existingMsg.id)
      emitInboxEvent({ type: 'message', inboxId: inbox.id, conversationId: existingMsg.conversation_id })
    }
  }

  // ─── messages.upsert + send.message ──────────────────────────────────────
  // send.message dispara quando Chatwoot (ou outro cliente) envia via Evolution API.
  // O payload é idêntico ao messages.upsert, sempre com fromMe: true.
  if (event === 'messages.upsert' || event === 'send.message') {
    const data = payload.data as Record<string, unknown>
    if (!data) {
      console.warn('[webhook] evento sem data | event:', event)
      return NextResponse.json({ ok: true })
    }

    const messages = Array.isArray(data) ? data : [data]

    for (const msg of messages) {
      const key = msg.key as Record<string, unknown>
      if (!key) continue

      const remoteJid = key.remoteJid as string
      if (!remoteJid || remoteJid.endsWith('@g.us')) continue

      const fromMe = key.fromMe as boolean
      const waMessageId = key.id as string
      const pushName = msg.pushName as string | undefined
      const message = msg.message as Record<string, unknown> | undefined
      if (!message) {
        console.warn('[webhook] mensagem sem campo message ignorada | event:', event, '| waId:', waMessageId, '| fromMe:', fromMe, '| jid:', remoteJid)
        continue
      }

      // ─── protocolMessage: edição/revogação de mensagem já existente ───────
      // Formato do payload ainda não confirmado contra esta instância — loga
      // e ignora tipos desconhecidos em vez de assumir e criar lixo no banco.
      const protocolMsg = message.protocolMessage as Record<string, unknown> | undefined
      if (protocolMsg) {
        try {
          const targetKey = protocolMsg.key as Record<string, unknown> | undefined
          const targetWaId = targetKey?.id as string | undefined
          const protoType = protocolMsg.type as string | undefined

          if (protoType === 'REVOKE' && targetWaId) {
            await markMessageDeleted(targetWaId)
          } else if (protoType === 'MESSAGE_EDIT' && targetWaId) {
            const editedMessage = protocolMsg.editedMessage as Record<string, unknown> | undefined
            const newBody = (editedMessage?.conversation as string | undefined)
              ?? (editedMessage?.extendedTextMessage as Record<string, unknown> | undefined)?.text as string | undefined
            if (newBody) {
              const { data: existingMsg } = await supabase
                .from('crm_messages')
                .select('id, conversation_id, body, original_body')
                .eq('wa_message_id', targetWaId)
                .maybeSingle()
              if (existingMsg) {
                await supabase.from('crm_messages').update({
                  body: newBody,
                  edited_at: new Date().toISOString(),
                  original_body: existingMsg.original_body ?? existingMsg.body,
                }).eq('id', existingMsg.id)
                emitInboxEvent({ type: 'message', inboxId: inbox.id, conversationId: existingMsg.conversation_id })
              }
            }
          } else {
            console.warn('[webhook] protocolMessage com formato inesperado:', JSON.stringify(protocolMsg))
          }
        } catch (err) {
          console.warn('[webhook] falha ao processar protocolMessage:', err)
        }
        continue
      }

      const { body, mediaType, mediaUrl } = extractMediaInfo(msg)
      const waPhone = normalizePhone(remoteJid)

      // Encontrar ou criar contato
      // pushName em mensagens fromMe = nome da empresa; só é confiável para inbound
      const contactName = !fromMe ? (pushName ?? waPhone) : waPhone

      let contactId: string | null = null
      let existingContact: { id: string; name: string; wa_push_name: string | null } | null = null

      // 1. Busca por wa_phone (contato já vinculado ao WhatsApp)
      const { data: byWaPhone } = await supabase
        .from('crm_contacts')
        .select('id, name, wa_push_name')
        .eq('wa_phone', waPhone)
        .maybeSingle()

      if (byWaPhone) {
        existingContact = byWaPhone
      } else {
        // 2. Fallback: contato cadastrado manualmente com mesmo phone mas sem wa_phone
        const { data: byPhone } = await supabase
          .from('crm_contacts')
          .select('id, name, wa_push_name')
          .eq('phone', waPhone)
          .is('wa_phone', null)
          .maybeSingle()
        if (byPhone) {
          existingContact = byPhone
          // Vincula o WhatsApp ao contato existente
          await supabase
            .from('crm_contacts')
            .update({ wa_phone: waPhone })
            .eq('id', byPhone.id)
        }
      }

      if (existingContact) {
        contactId = existingContact.id
        const contactUpdates: { name?: string; wa_push_name?: string } = {}
        // Corrige nome placeholder (= telefone) se agora temos o nome real via inbound
        if (!fromMe && pushName && existingContact.name === waPhone) {
          contactUpdates.name = pushName
        }
        // wa_push_name sempre reflete o nome mais recente reportado pelo WhatsApp,
        // independente do `name` — que é o campo editável pelo usuário no CRM
        if (!fromMe && pushName && pushName !== existingContact.wa_push_name) {
          contactUpdates.wa_push_name = pushName
        }
        if (Object.keys(contactUpdates).length > 0) {
          await supabase.from('crm_contacts').update(contactUpdates).eq('id', contactId)
        }
      } else {
        const { data: newContact } = await supabase
          .from('crm_contacts')
          .insert({
            wa_phone: waPhone,
            name: contactName,
            wa_push_name: !fromMe ? (pushName ?? null) : null,
            phone: waPhone,
            origin: 'whatsapp',
          })
          .select('id')
          .single()
        if (newContact) {
          contactId = newContact.id
          // Contato novo: busca a foto de perfil uma vez (não derruba o webhook se falhar)
          try {
            const avatarUrl = await fetchWhatsAppAvatarUrl(instanceName, waPhone)
            if (avatarUrl) {
              await supabase.from('crm_contacts')
                .update({ avatar_url: avatarUrl, avatar_synced_at: new Date().toISOString() })
                .eq('id', newContact.id)
            }
          } catch (err) {
            console.warn('[webhook] falha ao sincronizar foto de perfil:', waPhone, err)
          }
        }
      }

      // 1 conversa por contato: busca pela conversa mais recente do contato
      // (independente de inbox). Só cria nova se o contato nunca teve conversa.
      const now = new Date().toISOString()

      // Prioridade 1 — pelo contact_id (qualquer inbox)
      let existingConv: { id: string; unread_count: number } | null = null
      if (contactId) {
        const { data } = await supabase
          .from('crm_conversations')
          .select('id, unread_count')
          .eq('contact_id', contactId)
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        existingConv = data
      }

      // Fallback — pela chave (inbox_id, wa_jid) para contatos sem contact_id
      if (!existingConv) {
        const { data } = await supabase
          .from('crm_conversations')
          .select('id, unread_count')
          .eq('inbox_id', inbox.id)
          .eq('wa_jid', remoteJid)
          .maybeSingle()
        existingConv = data
      }

      let conv: { id: string } | null = null
      if (existingConv) {
        conv = existingConv
        await supabase
          .from('crm_conversations')
          .update({
            // Atualiza inbox e jid para que respostas saiam pelo canal correto
            inbox_id: inbox.id,
            wa_jid: remoteJid,
            contact_id: contactId,
            last_message: body,
            last_message_at: now,
            ...(!fromMe ? {
              unread_count: (existingConv.unread_count ?? 0) + 1,
              status: 'open',   // reabre automaticamente se o cliente responder
            } : {}),
          })
          .eq('id', existingConv.id)
      } else {
        const { data: newConv } = await supabase
          .from('crm_conversations')
          .insert({
            inbox_id: inbox.id,
            wa_jid: remoteJid,
            contact_id: contactId,
            last_message: body,
            last_message_at: now,
            unread_count: fromMe ? 0 : 1,
          })
          .select('id')
          .single()
        conv = newConv
      }

      if (!conv) continue

      // Remove base64 do metadata antes de salvar — send.message inclui o áudio/mídia
      // completo em base64 (~1 MB por mensagem), desnecessário pois temos a URL do MinIO.
      const msgForMetadata = msg.message && (msg.message as Record<string, unknown>).base64
        ? { ...msg, message: { ...(msg.message as Record<string, unknown>), base64: undefined } }
        : msg

      // Inserir mensagem (ignorar duplicatas por wa_message_id)
      const { error: msgError } = await supabase
        .from('crm_messages')
        .upsert(
          {
            conversation_id: conv.id,
            inbox_id: inbox.id,
            wa_message_id: waMessageId,
            direction: fromMe ? 'outbound' : 'inbound',
            body,
            media_type: mediaType,
            media_url: mediaUrl,
            sender_name: fromMe ? null : (pushName ?? null),
            status: 'delivered',
            metadata: msgForMetadata as import('@/lib/supabase/types').Json,
          },
          { onConflict: 'wa_message_id', ignoreDuplicates: true }
        )
      if (msgError) console.error('[webhook] falha ao salvar mensagem:', msgError.message, '| convId:', conv.id, '| waId:', waMessageId)

      // Notifica clientes SSE conectados
      emitInboxEvent({ type: 'message', inboxId: inbox.id, conversationId: conv.id })

      // Ponto de extensão AI (apenas inbound)
      if (!fromMe) {
        await maybeRouteToAI(supabase, {
          conversationId: conv.id,
          inboxId: inbox.id,
          contactId,
          contactName: pushName ?? waPhone,
          newMessageBody: body,
        })
      }
    }
  }

  // ─── messages.delete ────────────────────────────────────────────────────
  // Evento dedicado de exclusão (além do REVOKE via protocolMessage acima —
  // a Evolution manda um ou outro dependendo da versão/forma de exclusão).
  // Formato do payload ainda não confirmado: tenta os formatos mais comuns
  // (array de keys, ou uma key única) e loga o que não reconhecer.
  if (event === 'messages.delete') {
    try {
      const data = payload.data as Record<string, unknown> | Record<string, unknown>[] | undefined
      const keysArray: Record<string, unknown>[] = Array.isArray(data)
        ? data
        : Array.isArray((data as Record<string, unknown>)?.keys)
          ? (data as Record<string, unknown>).keys as Record<string, unknown>[]
          : data ? [data] : []

      let handled = 0
      for (const k of keysArray) {
        const waId = (k.id as string | undefined) ?? (k.keyId as string | undefined)
        if (waId) {
          await markMessageDeleted(waId)
          handled++
        }
      }
      if (handled === 0) {
        console.warn('[webhook] messages.delete com formato inesperado:', JSON.stringify(payload.data))
      }
    } catch (err) {
      console.warn('[webhook] falha ao processar messages.delete:', err)
    }
  }

  // ─── messages.update ──────────────────────────────────────────────────────
  // Evolution API v2 payload: { keyId, remoteJid, fromMe, status, ... }
  if (event === 'messages.update') {
    const updates = Array.isArray(payload.data) ? payload.data : [payload.data]
    for (const upd of updates) {
      if (!upd) continue
      const u = upd as Record<string, unknown>
      const waMessageId = u.keyId as string
      const status = u.status as string
      if (!waMessageId || !status) continue

      const statusMap: Record<string, 'sent' | 'delivered' | 'read' | 'failed'> = {
        SERVER_ACK:   'sent',
        DELIVERY_ACK: 'delivered',
        READ:         'read',
        PLAYED:       'read',
        ERROR:        'failed',
      }
      const mapped = statusMap[status]
      if (mapped) {
        await supabase
          .from('crm_messages')
          .update({ status: mapped })
          .eq('wa_message_id', waMessageId)
      }
    }
  }

  // ─── contacts.upsert ──────────────────────────────────────────────────────
  if (event === 'contacts.upsert') {
    const contacts = Array.isArray(payload.data) ? payload.data : [payload.data]
    for (const c of contacts) {
      if (!c) continue
      const contact = c as Record<string, unknown>
      const jid = contact.id as string
      const pushName = contact.pushName as string | undefined
      if (!jid || jid.endsWith('@g.us')) continue
      const waPhone = normalizePhone(jid)
      if (pushName) {
        const { data: existing } = await supabase
          .from('crm_contacts')
          .select('id, name, wa_push_name')
          .eq('wa_phone', waPhone)
          .maybeSingle()
        if (!existing) {
          const { data: newContact } = await supabase
            .from('crm_contacts')
            .insert({ wa_phone: waPhone, name: pushName, wa_push_name: pushName, phone: waPhone, origin: 'whatsapp' })
            .select('id')
            .single()
          if (newContact) {
            try {
              const avatarUrl = await fetchWhatsAppAvatarUrl(instanceName, waPhone)
              if (avatarUrl) {
                await supabase.from('crm_contacts')
                  .update({ avatar_url: avatarUrl, avatar_synced_at: new Date().toISOString() })
                  .eq('id', newContact.id)
              }
            } catch (err) {
              console.warn('[webhook] falha ao sincronizar foto de perfil:', waPhone, err)
            }
          }
        } else {
          const contactUpdates: { name?: string; wa_push_name?: string } = {}
          // Nome era placeholder; atualiza para o nome real
          if (existing.name === waPhone) contactUpdates.name = pushName
          // wa_push_name sempre reflete o nome mais recente reportado pelo WhatsApp
          if (pushName !== existing.wa_push_name) contactUpdates.wa_push_name = pushName
          if (Object.keys(contactUpdates).length > 0) {
            await supabase.from('crm_contacts').update(contactUpdates).eq('id', existing.id)
          }
        }
      }
    }
  }

  // ─── presence.update ────────────────────────────────────────────────────
  // Espelha a presença do contato (digitando/gravando) pro CRM via SSE.
  // Nunca persiste no banco (efêmero) e nunca pode derrubar o resto do
  // webhook — formato do payload ainda não confirmado contra esta instância,
  // então qualquer coisa inesperada só é logada e ignorada.
  if (event === 'presence.update') {
    try {
      const data = payload.data as Record<string, unknown> | undefined
      const remoteJid = data?.id as string | undefined
      const presences = data?.presences as Record<string, { lastKnownPresence?: string }> | undefined
      if (remoteJid && !remoteJid.endsWith('@g.us') && presences) {
        const entry = presences[remoteJid] ?? Object.values(presences)[0]
        const presence = entry?.lastKnownPresence
        const validPresences = ['composing', 'recording', 'paused', 'available', 'unavailable']
        if (presence && validPresences.includes(presence)) {
          const { data: conv } = await supabase
            .from('crm_conversations')
            .select('id')
            .eq('inbox_id', inbox.id)
            .eq('wa_jid', remoteJid)
            .maybeSingle()
          if (conv) {
            emitInboxEvent({
              type: 'presence',
              inboxId: inbox.id,
              conversationId: conv.id,
              presence: presence as 'composing' | 'recording' | 'paused' | 'available' | 'unavailable',
            })
          }
        } else {
          console.warn('[webhook] presence.update com formato inesperado:', JSON.stringify(payload.data))
        }
      }
    } catch (err) {
      console.warn('[webhook] falha ao processar presence.update:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
