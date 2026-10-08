import { createClient } from './supabase/server'
import { redirect } from 'next/navigation'

export async function getSessionUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return { user, profile, supabase }
}

/**
 * Guard global : vérifie que le profil est approuvé par un admin.
 * Un admin reste toujours accessible, même si son approval_status n'est pas 'approved'
 * (sinon on s'auto-bloque après la migration si l'ordre varie).
 */
function enforceApproval(profile: any) {
  if (!profile) return
  const isAdmin = profile.role === 'admin' || profile.role === 'coordinator'
  if (isAdmin) return
  if (profile.approval_status === 'approved') return
  if (profile.approval_status === 'rejected') redirect('/pending-approval?rejected=1')
  redirect('/pending-approval')
}

export async function requireAdmin() {
  const ctx = await getSessionUser()
  if (ctx.profile?.role !== 'admin' && ctx.profile?.role !== 'coordinator') redirect('/')
  return ctx
}

export async function requireTrainer() {
  const ctx = await getSessionUser()
  if (ctx.profile?.role !== 'trainer') redirect('/')
  enforceApproval(ctx.profile)
  let { data: trainer } = await ctx.supabase.from('trainers').select('*').eq('user_id', ctx.user.id).maybeSingle()

  // Filet de sécurité : si le formateur est approuvé mais que sa fiche n'existe pas
  // (ancien compte créé avant l'automatisation), on la crée à la volée pour qu'il
  // puisse immédiatement saisir ses heures.
  if (!trainer && ctx.profile?.approval_status === 'approved') {
    const email = ctx.profile?.email ?? ctx.user.email ?? ''
    const first = ctx.profile?.first_name || (email.split('@')[0] || 'Formateur')
    const last = ctx.profile?.last_name || ''
    const { data: created } = await ctx.supabase.from('trainers').insert({
      user_id: ctx.user.id,
      first_name: first,
      last_name: last,
      email: email || null,
      active: true,
    }).select('*').single()
    trainer = created ?? null
  }

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
