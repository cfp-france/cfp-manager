import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(req: NextRequest) {
  let res = NextResponse.next({ request: req })
  const path = req.nextUrl.pathname
  const isAuthPage = path === '/login' || path.startsWith('/auth')

  // Timeout de 4s : si Supabase ne répond pas, on laisse passer sans vérifier
  // (l'auth sera vérifié côté page via requireAdmin/requireTrainer)
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll() },
          setAll(all: { name: string; value: string; options: any }[]) {
            all.forEach(({ name, value }) => req.cookies.set(name, value))
            res = NextResponse.next({ request: req })
            all.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
          },
        },
      }
    )
    const authPromise = supabase.auth.getUser()
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('supabase-timeout')), 4000))
    const result = await Promise.race([authPromise, timeoutPromise]) as any
    const user = result?.data?.user ?? null

    if (!user && !isAuthPage) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    if (user && path === '/login') {
      return NextResponse.redirect(new URL('/', req.url))
    }
  } catch (e) {
    // Si timeout ou erreur Supabase, laisser passer — les pages font leur propre check
    console.warn('[middleware] Supabase timeout ou erreur, on laisse passer :', (e as Error).message)
  }
  return res
}
