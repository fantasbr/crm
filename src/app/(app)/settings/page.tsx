import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from '@/components/crm/settings-client'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()

  const [pipelinesRes, servicesRes] = await Promise.all([
    supabase.from('crm_pipelines').select('*, crm_stages(*)').order('created_at'),
    supabase.from('crm_services').select('*, crm_service_plans(*)').order('order'),
  ])

  return (
    <SettingsClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pipelines={(pipelinesRes.data ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      services={(servicesRes.data ?? []) as any}
    />
  )
}
