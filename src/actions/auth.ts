'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function logout() {
  const s = createClient()
  await s.auth.signOut()
  redirect('/login')
}
