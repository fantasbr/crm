'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#181614' }}>

      {/* Painel esquerdo — marca */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12"
        style={{ backgroundColor: '#181614', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#24a78d' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3"/>
              <line x1="12" y1="2" x2="12" y2="9"/>
              <line x1="12" y1="15" x2="12" y2="22"/>
              <line x1="2" y1="12" x2="9" y2="12"/>
              <line x1="15" y1="12" x2="22" y2="12"/>
            </svg>
          </div>
          <div>
            <p className="font-semibold text-white">Grupo Branca</p>
            <p className="text-xs" style={{ color: '#24a78d' }}>CRM Comercial</p>
          </div>
        </div>

        <div>
          <blockquote className="text-white/70 text-lg leading-relaxed font-light italic mb-8">
            "Se educar é preparar para a vida.<br />
            Educar para o trânsito é salvar vidas."
          </blockquote>

          <div className="space-y-4">
            {[
              { label: 'Pipeline de vendas', desc: 'Acompanhe cada negociação em tempo real' },
              { label: 'Gestão de contatos', desc: 'Central de leads com histórico completo' },
              { label: 'Equipes configuráveis', desc: 'Controle de acesso por equipe e pipeline' },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full mt-0.5 flex-shrink-0" style={{ backgroundColor: '#24a78d' }}>
                  <svg viewBox="0 0 20 20" fill="white" className="w-5 h-5 p-1"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{item.label}</p>
                  <p className="text-white/40 text-xs">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/20 text-xs">© {new Date().getFullYear()} Grupo Branca Autoescolas. Todos os direitos reservados.</p>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ backgroundColor: '#1f1d1b' }}>
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#24a78d' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="3"/>
                <line x1="12" y1="2" x2="12" y2="9"/>
                <line x1="12" y1="15" x2="12" y2="22"/>
                <line x1="2" y1="12" x2="9" y2="12"/>
                <line x1="15" y1="12" x2="22" y2="12"/>
              </svg>
            </div>
            <p className="font-semibold text-white">Grupo Branca CRM</p>
          </div>

          <h1 className="text-2xl font-semibold text-white mb-1">Bem-vindo de volta</h1>
          <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Entre com suas credenciais para acessar o CRM
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                E-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-white/20 focus:outline-none transition-all"
                style={{
                  backgroundColor: '#2a2825',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#24a78d'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Senha
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-white/20 focus:outline-none transition-all"
                style={{
                  backgroundColor: '#2a2825',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#24a78d'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-lg text-sm text-red-400 bg-red-500/10 border border-red-500/20">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: '#24a78d' }}
              onMouseEnter={e => !loading && (e.currentTarget.style.backgroundColor = '#1e9479')}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#24a78d'}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
