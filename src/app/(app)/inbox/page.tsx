import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InboxClient } from '@/components/crm/inbox-client'

export const dynamic = 'force-dynamic'

const CONVERSATION_SELECT = '*, crm_contacts(id, name, phone, email, origin, wa_push_name, avatar_url)'

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ conv?: string; phone?: string; contact?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams

  const [inboxesRes, pipelinesRes] = await Promise.all([
    supabase.from('crm_inboxes').select('*').eq('active', true).order('created_at'),
    supabase.from('crm_pipelines').select('id, crm_stages(*)').order('created_at').limit(1),
  ])

  const inboxes = inboxesRes.data ?? []
  const firstInboxId = inboxes[0]?.id ?? null

  // Deep-link por contato (?contact=): resolve o contato e, se ele JÁ tiver
  // conversa (em qualquer inbox), abre nela — no inbox certo. Se não tiver,
  // o client entra no modo "compose" com seletor de inbox (primeira mensagem).
  let initialContact: {
    id: string; name: string; phone: string; wa_phone: string | null; avatar_url: string | null
  } | null = null
  let initialConvId = params.conv ?? null
  let targetInboxId = firstInboxId

  if (params.contact) {
    const { data: contact } = await supabase
      .from('crm_contacts')
      .select('id, name, phone, wa_phone, avatar_url')
      .eq('id', params.contact)
      .maybeSingle()
    initialContact = contact ?? null

    if (contact) {
      const { data: existingConv } = await supabase
        .from('crm_conversations')
        .select('id, inbox_id')
        .eq('contact_id', contact.id)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (existingConv) {
        initialConvId = existingConv.id
        targetInboxId = existingConv.inbox_id  // abre a aba do inbox que tem a conversa
      }
    }
  }

  // Carregar conversas do inbox alvo (SSR para fast initial render)
  const conversationsRes = targetInboxId
    ? await supabase
        .from('crm_conversations')
        .select(CONVERSATION_SELECT)
        .eq('inbox_id', targetInboxId)
        .eq('status', 'open')
        .order('last_message_at', { ascending: false })
        .limit(50)
    : { data: [] }

  let initialConversations = conversationsRes.data ?? []

  // A conversa vinda por ?conv= / ?contact= pode não estar entre as 50 mais
  // recentes do inbox alvo — sem isso, a página abre mas a conversa some.
  if (initialConvId && !initialConversations.some(c => c.id === initialConvId)) {
    const { data: deepLinked } = await supabase
      .from('crm_conversations')
      .select(CONVERSATION_SELECT)
      .eq('id', initialConvId)
      .maybeSingle()
    if (deepLinked) initialConversations = [deepLinked, ...initialConversations]
  }

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400 text-sm">Carregando inbox...</div>}>
      <InboxClient
        inboxes={inboxes}
        initialConversations={initialConversations}
        initialInboxId={targetInboxId}
        initialConvId={initialConvId}
        initialPhone={params.phone ?? null}
        initialContactId={params.contact ?? null}
        initialContact={initialContact}
        pipelineId={pipelinesRes.data?.[0]?.id ?? null}
        stages={(pipelinesRes.data?.[0]?.crm_stages ?? []) as import('@/lib/supabase/types').Database['public']['Tables']['crm_stages']['Row'][]}
      />
    </Suspense>
  )
}
