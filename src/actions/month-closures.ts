'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function monthRange(year: number, month: number) {
  const from = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10)
  const to = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  return { from, to }
}

/**
 * Calcule les heures + montant HT d'un formateur pour un mois donné,
 * sur la base des time_entries soumises OU validées (pas les brouillons).
 */
async function monthTotals(s: any, trainerId: string, year: number, month: number) {
  const { from, to } = monthRange(year, month)
  const { data: entries } = await s.from('time_entries')
    .select(`hours_actual, session:mission_sessions(mission:missions(trainer_hourly_rate))`)
    .eq('trainer_id', trainerId)
    .in('status', ['submitted', 'validated'])
    .gte('work_date', from)
    .lte('work_date', to)
  const { data: trainer } = await s.from('trainers').select('hourly_rate_default').eq('id', trainerId).single()
  const defaultRate = Number(trainer?.hourly_rate_default ?? 0)
  let hours = 0, amount = 0
  for (const e of entries ?? []) {
    const h = Number((e as any).hours_actual ?? 0)
    const rate = Number((e as any).session?.mission?.trainer_hourly_rate) || defaultRate
    hours += h
    amount += h * rate
  }
  return { hours: Math.round(hours * 100) / 100, amount: Math.round(amount * 100) / 100 }
}

/**
 * Clôture par le formateur lui-même de son mois.
 * Indique à l'admin : "j'ai saisi toutes mes heures, tu peux facturer les CFA et me payer."
 */
export async function closeMyMonth(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) redirect('/login')
  const { data: trainer } = await s.from('trainers').select('id').eq('user_id', user.id).single()
  if (!trainer) return

  const year = Number(formData.get('year'))
  const month = Number(formData.get('month'))
  if (!year || !month) return

  // Déjà clôturé ?
  const { data: existing } = await s.from('trainer_month_closures')
    .select('id').eq('trainer_id', trainer.id).eq('period_year', year).eq('period_month', month).maybeSingle()
  if (existing) {
    revalidatePath('/invoices')
    return redirect('/invoices?toast=' + encodeURIComponent('Ce mois est déjà clôturé.'))
  }

  const totals = await monthTotals(s, trainer.id, year, month)
  const { error } = await s.from('trainer_month_closures').insert({
    trainer_id: trainer.id,
    period_year: year,
    period_month: month,
    total_hours: totals.hours,
    total_amount_ht: totals.amount,
    closed_by: user.id,
    closed_by_admin: false,
  })
  if (error) return redirect('/invoices?error=' + encodeURIComponent(error.message))

  revalidatePath('/invoices')
  revalidatePath('/invoicing')
  redirect('/invoices?toast=' + encodeURIComponent('Mois clôturé. L\'administration a été notifiée.'))
}

/** L'admin clôture le mois d'un formateur à sa place. */
export async function closeTrainerMonthAsAdmin(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) redirect('/login')

  const trainer_id = formData.get('trainer_id') as string
  const year = Number(formData.get('year'))
  const month = Number(formData.get('month'))
  if (!trainer_id || !year || !month) return

  const { data: existing } = await s.from('trainer_month_closures')
    .select('id').eq('trainer_id', trainer_id).eq('period_year', year).eq('period_month', month).maybeSingle()
  if (existing) {
    revalidatePath('/invoicing')
    return redirect('/invoicing?toast=' + encodeURIComponent('Ce mois est déjà clôturé.'))
  }

  const totals = await monthTotals(s, trainer_id, year, month)
  const { error } = await s.from('trainer_month_closures').insert({
    trainer_id,
    period_year: year,
    period_month: month,
    total_hours: totals.hours,
    total_amount_ht: totals.amount,
    closed_by: user.id,
    closed_by_admin: true,
  })
  if (error) return redirect('/invoicing?error=' + encodeURIComponent(error.message))

  revalidatePath('/invoicing')
  redirect('/invoicing?toast=' + encodeURIComponent('Mois clôturé pour le formateur.'))
}

/** L'admin marque la clôture mensuelle comme payée (règlement hors plateforme). */
export async function markMonthClosurePaid(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) redirect('/login')

  const id = formData.get('id') as string
  const reference = (formData.get('payment_reference') as string) || null
  if (!id) return

  const { error } = await s.from('trainer_month_closures').update({
    paid_at: new Date().toISOString(),
    paid_by: user.id,
    payment_reference: reference,
  }).eq('id', id)
  if (error) return redirect('/invoicing?error=' + encodeURIComponent(error.message))

  revalidatePath('/invoicing')
  revalidatePath('/invoices')
  redirect('/invoicing?toast=' + encodeURIComponent('Règlement du mois enregistré.'))
}

/** L'admin rouvre un mois clôturé (en cas d'oubli de saisie du formateur). */
export async function reopenMonthClosure(formData: FormData) {
  const s = createClient()
  const id = formData.get('id') as string
  if (!id) return
  const { error } = await s.from('trainer_month_closures').delete().eq('id', id)
  if (error) return redirect('/invoicing?error=' + encodeURIComponent(error.message))
  revalidatePath('/invoicing')
  revalidatePath('/invoices')
  redirect('/invoicing?toast=' + encodeURIComponent('Mois rouvert — le formateur peut à nouveau saisir.'))
}
