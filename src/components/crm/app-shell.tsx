'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Sidebar } from './sidebar'

interface AppShellProps {
  userName: string
  userEmail: string
  userRole: string
  children: React.ReactNode
}

// `null` = padrão responsivo (fechada no mobile, aberta no desktop, via CSS).
// `true`/`false` = o usuário forçou explicitamente, vale em qualquer tamanho de tela.
export function AppShell({ userName, userEmail, userRole, children }: AppShellProps) {
  const [manualOpen, setManualOpen] = useState<boolean | null>(null)
  const isClosedOnDesktop = manualOpen === false

  return (
    <>
      <Sidebar
        userName={userName}
        userEmail={userEmail}
        userRole={userRole}
        manualOpen={manualOpen}
        onOpen={() => setManualOpen(true)}
        onClose={() => setManualOpen(false)}
      />
      {/* pt-14 reserva espaço pro botão flutuante de abrir o menu, que aparece
          sempre que a sidebar está fechada — no mobile por padrão, ou em
          qualquer tela quando o usuário fecha manualmente. */}
      <main className={cn(
        'flex-1 overflow-auto min-w-0',
        manualOpen === true ? '' : 'pt-14',
        isClosedOnDesktop ? 'md:pt-14' : 'md:pt-0'
      )}>
        {children}
      </main>
    </>
  )
}
