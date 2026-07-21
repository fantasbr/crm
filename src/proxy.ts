import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/supabase/types'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() pode LANÇAR quando o token está inválido/revogado (ex: signOut
  // global disparado por outro app do mesmo usuário, ou sessão expirada). Sem
  // este try/catch a exceção derrubava o request e a página travava carregando
  // — em vez de mandar pro login. Trata como "sem usuário".
  let user = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data.user
  } catch {
    user = null
  }

  const pathname = request.nextUrl.pathname

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/auth')
  const isPublic = isAuthPage || pathname.startsWith('/api/')

  if (!user && !isPublic) {
    const res = NextResponse.redirect(new URL('/login', request.url))
    // Havia cookie de sessão mas não resultou em usuário → está inválido.
    // Limpa os cookies sb-* (inclui chunks .0/.1) pra não repetir a falha a
    // cada navegação e forçar um estado limpo no login. Se não há cookie
    // (usuário só não logado), o loop não faz nada.
    for (const c of request.cookies.getAll()) {
      if (c.name.startsWith('sb-')) res.cookies.delete(c.name)
    }
    return res
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
