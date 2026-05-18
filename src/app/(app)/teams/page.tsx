import { createClient } from '@/lib/supabase/server'
import { TeamsClient } from '@/components/crm/teams-client'

export const dynamic = 'force-dynamic'

export default async function TeamsPage() {
  const supabase = await createClient()

  const [teamsRes, usersRes, pipelinesRes] = await Promise.all([
    supabase.from('crm_teams').select(`
      *,
      crm_team_members(user_id, crm_users(id, name, role)),
      crm_team_pipelines(pipeline_id, crm_pipelines(id, name))
    `).order('name'),
    supabase.from('crm_users').select('*').order('name'),
    supabase.from('crm_pipelines').select('id, name').order('name'),
  ])

  return (
    <TeamsClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      teams={(teamsRes.data ?? []) as any}
      allUsers={usersRes.data ?? []}
      allPipelines={pipelinesRes.data ?? []}
    />
  )
}
