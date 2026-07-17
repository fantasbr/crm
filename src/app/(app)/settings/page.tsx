import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from '@/components/crm/settings-client'

export const dynamic = 'force-dynamic'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const supabase = await createClient()

  const [pipelinesRes, servicesRes, teamsRes, usersRes] = await Promise.all([
    supabase.from('crm_pipelines').select('*, crm_stages(*)').order('created_at'),
    supabase.from('crm_services').select('*, crm_service_plans(*)').order('order'),
    supabase.from('crm_teams').select(`
      *,
      crm_team_members(user_id, crm_users(id, name, role)),
      crm_team_pipelines(pipeline_id, crm_pipelines(id, name))
    `).order('name'),
    supabase.from('crm_users').select('*').order('name'),
  ])

  const { tab } = await searchParams

  return (
    <SettingsClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pipelines={(pipelinesRes.data ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      services={(servicesRes.data ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      teams={(teamsRes.data ?? []) as any}
      users={usersRes.data ?? []}
      initialTab={tab === 'equipes' ? 'equipes' : tab === 'servicos' ? 'servicos' : 'pipelines'}
    />
  )
}
