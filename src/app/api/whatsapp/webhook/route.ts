import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { maybeRouteToAI } from '@/lib/ai-agent'

export const runtime = 'nodejs'

function normalizePhone(jid: string): string {
  // "5562999991111@s.whatsapp.net" → "5562999991111"
  return jid.split('@')[0].replace(/\D/g, '')
}

function extractBody(message: Record<string, unknown>): string {
  return (
    (message.conversation as string) ??
    ((message.extendedTextMessage as Record<string, unknown>)?.text as string) ??
    ((message.imageMessage as Record<string, unknown>)?.caption as string) ??
    ((message.videoMessage as Record<string, unknown>)?.caption as string) ??
    '[mídia]'
  )
}

export async function POST(req: NextRequest) {
  // Validação do token via query param
  // Configure o webhook na Evolution API como:
  //   https://seu-crm.com/api/whatsapp/webhook?token=<EVOLUTION_WEBHOOK_TOKEN>
  const token = req.nextUrl.searchParams.get('token')
  if (token !== process.env.EVOLUTION_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
  const { data: inbox } = await supabase
    .from('crm_inboxes')
    .select('*')
    .eq('wa_instance', instanceName)
    .eq('active', true)
    .single()

  if (!inbox) return NextResponse.json({ ok: true })

  // ─── messages.upsert ──────────────────────────────────────────────────────
  if (event === 'messages.upsert') {
    const data = payload.data as Record<string, unknown>
    if (!data) return NextResponse.json({ ok: true })

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
      if (!message) continue

      const body = extractBody(message)
      const waPhone = normalizePhone(remoteJid)

      // Encontrar ou criar contato — nunca sobrescreve phone/name existentes
      let contactId: string | null = null
      const { data: existingContact } = await supabase
        .from('crm_contacts')
        .select('id')
        .eq('wa_phone', waPhone)
        .maybeSingle()
      if (existingContact) {
        contactId = existingContact.id
      } else {
        const { data: newContact } = await supabase
          .from('crm_contacts')
          .insert({ wa_phone: waPhone, name: pushName ?? waPhone, phone: waPhone, origin: 'whatsapp' })
          .select('id')
          .single()
        if (newContact) contactId = newContact.id
      }

      // Encontrar ou criar conversa — incremento correto de unread_count
      const now = new Date().toISOString()
      const { data: existingConv } = await supabase
        .from('crm_conversations')
        .select('id, unread_count')
        .eq('inbox_id', inbox.id)
        .eq('wa_jid', remoteJid)
        .maybeSingle()

      let conv: { id: string } | null = null
      if (existingConv) {
        conv = existingConv
        await supabase
          .from('crm_conversations')
          .update({
            contact_id: contactId,
            last_message: body,
            last_message_at: now,
            ...(!fromMe ? { unread_count: (existingConv.unread_count ?? 0) + 1 } : {}),
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

      // Inserir mensagem (ignorar duplicatas por wa_message_id)
      await supabase
        .from('crm_messages')
        .upsert(
          {
            conversation_id: conv.id,
            wa_message_id: waMessageId,
            direction: fromMe ? 'outbound' : 'inbound',
            body,
            sender_name: fromMe ? null : (pushName ?? null),
            status: 'delivered',
            metadata: msg as import('@/lib/supabase/types').Json,
          },
          { onConflict: 'wa_message_id', ignoreDuplicates: true }
        )

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

  // ─── messages.update ──────────────────────────────────────────────────────
  if (event === 'messages.update') {
    const updates = Array.isArray(payload.data) ? payload.data : [payload.data]
    for (const upd of updates) {
      if (!upd) continue
      const u = upd as Record<string, unknown>
      const key = u.key as Record<string, unknown>
      const waMessageId = key?.id as string
      const status = (u.update as Record<string, unknown>)?.status as string
      if (!waMessageId || !status) continue

      const statusMap: Record<string, string> = {
        DELIVERY_ACK: 'delivered',
        READ: 'read',
        PLAYED: 'read',
        ERROR: 'failed',
      }
      const mapped = statusMap[status]
      if (mapped) {
        await supabase
          .from('crm_messages')
          .update({ status: mapped as 'sent' | 'delivered' | 'read' | 'failed' })
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
          .select('id')
          .eq('wa_phone', waPhone)
          .maybeSingle()
        if (!existing) {
          await supabase
            .from('crm_contacts')
            .insert({ wa_phone: waPhone, name: pushName, phone: waPhone, origin: 'whatsapp' })
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
