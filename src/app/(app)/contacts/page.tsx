import { createClient } from '@/lib/supabase/server'
import { ContactsTable } from '@/components/crm/contacts-table'

export const dynamic = 'force-dynamic'

export default async function ContactsPage() {
  const supabase = await createClient()

  const [contactsRes, dealsRes] = await Promise.all([
    supabase.from('crm_contacts').select('*').order('created_at', { ascending: false }),
    supabase.from('crm_deals').select('contact_id, service_id, temperature, negotiated_value, status, crm_services(name)').eq('status', 'open'),
  ])

  const contacts = contactsRes.data ?? []
  const deals = dealsRes.data ?? []

  return <ContactsTable contacts={contacts} deals={deals} />
}
