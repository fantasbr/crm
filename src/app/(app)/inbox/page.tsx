import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InboxClient } from '@/components/crm/inbox-client'

export const dynamic = 'force-dynamic'

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ conv?: string; phone?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [inboxesRes, pipelinesRes] = await Promise.all([
    supabase.from('crm_inboxes').select('*').eq('active', true).order('created_at'),
    supabase.from('crm_pipelines').select('id, crm_stages(*)').order('created_at').limit(1),
  ])

  const inboxes = inboxesRes.data ?? []
  const firstInboxId = inboxes[0]?.id ?? null

  // Carregar conversas do primeiro inbox (SSR para fast initial render)
  const conversationsRes = firstInboxId
    ? await supabase
        .from('crm_conversations')
        .select('*, crm_contacts(id, name, phone)')
        .eq('inbox_id', firstInboxId)
        .eq('status', 'open')
        .order('last_message_at', { ascending: false })
        .limit(50)
    : { data: [] }

  const params = await searchParams

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400 text-sm">Carregando inbox...</div>}>
      <InboxClient
        inboxes={inboxes}
        initialConversations={conversationsRes.data ?? []}
        initialInboxId={firstInboxId}
        initialConvId={params.conv ?? null}
        initialPhone={params.phone ?? null}
        pipelineId={pipelinesRes.data?.[0]?.id ?? null}
        stages={(pipelinesRes.data?.[0]?.crm_stages ?? []) as import('@/lib/supabase/types').Database['public']['Tables']['crm_stages']['Row'][]}
      />
    </Suspense>
  )
}
