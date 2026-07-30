import { createClient } from './supabase/server'
import { redirect } from 'next/navigation'

export async function getSessionUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return { user, profile, supabase }
}

export async function requireAdmin() {
  const ctx = await getSessionUser()
  if (ctx.profile?.role !== 'admin' && ctx.profile?.role !== 'coordinator') redirect('/')
  return ctx
}

export async function requireTrainer() {
  const ctx = await getSessionUser()
  if (ctx.profile?.role !== 'trainer') redirect('/')
  const { data: trainer } = await ctx.supabase.from('trainers').select('*').eq('user_id', ctx.user.id).single()
  return { ...ctx, trainer }
}

export function fmtDate(d: string | Date) {
  const dt = typeof d === 'string' ? new Date(d) : d
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function fmtHours(h: number) {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return `${hh}h${mm.toString().padStart(2, '0')}`
}

export function fmtEuro(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}
