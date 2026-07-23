import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

// Cria (ou reaproveita) a conversa de um contato num inbox escolhido, pra
// permitir enviar a PRIMEIRA mensagem a um contato que ainda não tem conversa.
// O envio em si continua sendo feito por /api/whatsapp/send com o conversationId
// retornado aqui.
export async function POST(req: NextRequest) {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { inboxId, contactId } = await req.json() as { inboxId?: string; contactId?: string }
  if (!inboxId || !contactId) {
    return NextResponse.json({ error: 'inboxId e contactId são obrigatórios' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Inbox precisa existir e estar ativo
  const { data: inbox } = await supabase
    .from('crm_inboxes')
    .select('id')
    .eq('id', inboxId)
    .eq('active', true)
    .maybeSingle()
  if (!inbox) return NextResponse.json({ error: 'Inbox não encontrado' }, { status: 404 })

  // Contato → deriva o wa_jid a partir do WhatsApp (wa_phone) ou do telefone
  const { data: contact } = await supabase
    .from('crm_contacts')
    .select('id, phone, wa_phone')
    .eq('id', contactId)
    .maybeSingle()
  if (!contact) return NextResponse.json({ error: 'Contato não encontrado' }, { status: 404 })

  const digits = (contact.wa_phone ?? contact.phone ?? '').replace(/\D/g, '')
  if (!digits) return NextResponse.json({ error: 'Contato não tem telefone válido' }, { status: 400 })
  const waJid = `${digits}@s.whatsapp.net`

  // Find-or-create espelhando o dedupe do webhook: 1 conversa por contato.
  // 1) por contact_id (qualquer inbox, mais recente)
  let existing: { id: string } | null = null
  {
    const { data } = await supabase
      .from('crm_conversations')
      .select('id')
      .eq('contact_id', contactId)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    existing = data
  }
  // 2) fallback pela chave (inbox_id, wa_jid) — respeita o UNIQUE do schema
  if (!existing) {
    const { data } = await supabase
      .from('crm_conversations')
      .select('id')
      .eq('inbox_id', inboxId)
      .eq('wa_jid', waJid)
      .maybeSingle()
    existing = data
  }

  if (existing) {
    // Reaproveita a conversa, movendo pro inbox escolhido (respostas saem pelo
    // canal certo) e garantindo que está aberta.
    await supabase
      .from('crm_conversations')
      .update({ inbox_id: inboxId, wa_jid: waJid, contact_id: contactId, status: 'open' })
      .eq('id', existing.id)
    return NextResponse.json({ ok: true, conversationId: existing.id, inboxId })
  }

  const { data: created, error: insertErr } = await supabase
    .from('crm_conversations')
    .insert({ inbox_id: inboxId, contact_id: contactId, wa_jid: waJid, status: 'open' })
    .select('id')
    .single()
  if (insertErr || !created) {
    console.error('[conversations/start] falha ao criar conversa:', insertErr?.message)
    return NextResponse.json({ error: 'Falha ao criar conversa' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, conversationId: created.id, inboxId })
}
