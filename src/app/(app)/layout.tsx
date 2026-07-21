import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/crm/app-shell'
import { AuthListener } from '@/components/crm/auth-listener'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  // getUser() pode lançar com token inválido/revogado — trata como sem sessão
  // e cai no redirect, em vez de deixar a exceção travar o render do layout.
  let user = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data.user
  } catch {
    user = null
  }

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
      <AuthListener />
      <AppShell userName={userName} userEmail={user.email ?? ''} userRole={userRole}>
        {children}
      </AppShell>
    </div>
  )
}
