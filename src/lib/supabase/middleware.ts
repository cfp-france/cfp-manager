import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(req: NextRequest) {
  let res = NextResponse.next({ request: req })
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
  const { data: { user } } = await supabase.auth.getUser()
  const path = req.nextUrl.pathname
  const isAuthPage = path === '/login' || path.startsWith('/auth')
  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (user && path === '/login') {
    return NextResponse.redirect(new URL('/', req.url))
  }
  return res
}
