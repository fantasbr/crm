import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/crm/app-shell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('crm_users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const userName = profile?.name ?? user.email ?? 'Usuário'
  const userRole = profile?.role ?? 'seller'

  return (
    <div className="flex h-screen bg-gray-50 min-w-0">
      <AppShell userName={userName} userEmail={user.email ?? ''} userRole={userRole}>
        {children}
      </AppShell>
    </div>
  )
}
