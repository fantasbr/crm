import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { conversationId, text } = await req.json() as { conversationId: string; text: string }
  if (!conversationId || !text?.trim()) {
    return NextResponse.json({ error: 'conversationId and text are required' }, { status: 400 })
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

  // Enviar mensagem via Evolution API
  const sendRes = await fetch(
    `${evolutionUrl}/message/sendText/${inbox.wa_instance}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
      body: JSON.stringify({ number: conv.wa_jid, text }),
    }
  )

  if (!sendRes.ok) {
    const errBody = await sendRes.text()
    return NextResponse.json({ error: 'Evolution API error', detail: errBody }, { status: 502 })
  }

  const sendData = await sendRes.json() as Record<string, unknown>
  const waMessageId = (sendData.key as Record<string, unknown>)?.id as string | undefined

  const now = new Date().toISOString()

  // Salvar mensagem no banco
  await supabase.from('crm_messages').insert({
    conversation_id: conversationId,
    wa_message_id: waMessageId ?? null,
    direction: 'outbound',
    body: text,
    status: 'sent',
    sent_by: user.id,
  })

  // Atualizar last_message na conversa
  await supabase
    .from('crm_conversations')
    .update({ last_message: text, last_message_at: now, unread_count: 0 })
    .eq('id', conversationId)

  return NextResponse.json({ ok: true })
}
