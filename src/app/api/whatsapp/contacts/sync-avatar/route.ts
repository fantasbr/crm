import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchWhatsAppAvatarUrl } from '@/lib/evolution'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contactId } = await req.json() as { contactId?: string }
  if (!contactId) {
    return NextResponse.json({ error: 'contactId é obrigatório' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: contact, error: contactErr } = await supabase
    .from('crm_contacts')
    .select('id, wa_phone')
    .eq('id', contactId)
    .single()

  if (contactErr || !contact) {
    return NextResponse.json({ error: 'Contato não encontrado' }, { status: 404 })
  }
  if (!contact.wa_phone) {
    return NextResponse.json({ error: 'Contato não tem WhatsApp vinculado' }, { status: 400 })
  }

  // Determina qual instância usar: o inbox da conversa mais recente do
  // contato, ou o primeiro inbox ativo como fallback.
  const { data: recentConv } = await supabase
    .from('crm_conversations')
    .select('crm_inboxes(wa_instance)')
    .eq('contact_id', contactId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let waInstance = (recentConv?.crm_inboxes as { wa_instance: string } | null)?.wa_instance ?? null
  if (!waInstance) {
    const { data: fallbackInbox } = await supabase
      .from('crm_inboxes')
      .select('wa_instance')
      .eq('active', true)
      .limit(1)
      .maybeSingle()
    waInstance = fallbackInbox?.wa_instance ?? null
  }

  if (!waInstance) {
    return NextResponse.json({ error: 'Nenhum inbox ativo configurado' }, { status: 400 })
  }

  const avatarUrl = await fetchWhatsAppAvatarUrl(waInstance, contact.wa_phone)
  const avatarSyncedAt = new Date().toISOString()

  await supabase
    .from('crm_contacts')
    .update({ avatar_url: avatarUrl, avatar_synced_at: avatarSyncedAt })
    .eq('id', contactId)

  return NextResponse.json({ ok: true, avatarUrl, avatarSyncedAt })
}
