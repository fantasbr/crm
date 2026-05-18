'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, Kanban, UsersRound,
  Settings, LogOut, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard', label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/pipeline',  label: 'Pipeline',       icon: Kanban },
  { href: '/contacts',  label: 'Contatos',       icon: Users },
  { href: '/teams',     label: 'Equipes',         icon: UsersRound },
  { href: '/settings',  label: 'Configurações',   icon: Settings },
]

interface SidebarProps {
  userName: string
  userEmail: string
  userRole: string
}

export function Sidebar({ userName, userEmail, userRole }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initial = userName?.charAt(0).toUpperCase() ?? '?'

  const roleLabel: Record<string, string> = {
    admin: 'Administrador',
    manager: 'Gerente',
    seller: 'Vendedor',
  }

  return (
    <aside className="w-56 xl:w-64 flex flex-col h-full flex-shrink-0" style={{ backgroundColor: '#181614' }}>

      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#24a78d' }}
          >
            {/* Ícone de volante estilizado */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3"/>
              <line x1="12" y1="2" x2="12" y2="9"/>
              <line x1="12" y1="15" x2="12" y2="22"/>
              <line x1="2" y1="12" x2="9" y2="12"/>
              <line x1="15" y1="12" x2="22" y2="12"/>
            </svg>
          </div>
          <div>
            <p className="font-semibold text-white text-sm leading-tight">Grupo Branca</p>
            <p className="text-[11px]" style={{ color: '#24a78d' }}>CRM Comercial</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                active
                  ? 'text-white'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              )}
              style={active ? { backgroundColor: '#24a78d' } : {}}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-white' : 'text-white/40 group-hover:text-white/60')} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3.5 h-3.5 text-white/60" />}
            </Link>
          )
        })}
      </nav>

      {/* Divisor */}
      <div className="mx-4 border-t border-white/10" />

      {/* User */}
      <div className="p-4">
        <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors group">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
            style={{ backgroundColor: '#24a78d' }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            <p className="text-[11px] truncate" style={{ color: '#24a78d' }}>
              {roleLabel[userRole] ?? userRole}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-white/30 hover:text-white/70 transition-colors opacity-0 group-hover:opacity-100"
            title="Sair"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
