'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Cura o "carregando infinito" quando a sessão é encerrada por baixo dos panos
 * — ex: signOut global disparado por outro app do mesmo usuário, ou refresh
 * token revogado/rotacionado. O supabase-js emite SIGNED_OUT quando desiste da
 * sessão; aqui a gente reage mandando pro login em vez de deixar a aba travada
 * numa página que depende de uma sessão que não existe mais.
 *
 * Complementa o middleware (proxy.ts): o middleware cura na próxima navegação
 * server-side; este listener cura a aba que já estava aberta, sem F5.
 */
export function AuthListener() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/login')
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  return null
}
