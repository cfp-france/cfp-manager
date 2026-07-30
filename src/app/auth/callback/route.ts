import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  if (code) { const s = createClient(); await s.auth.exchangeCodeForSession(code) }
  return NextResponse.redirect(`${origin}/`)
}
