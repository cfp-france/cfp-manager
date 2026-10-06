'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function monthRange(year: number, month: number) {
  const from = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10)
  const to = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  return { from, to }
}

async function nextTrainerInvoiceNumber(s: any, year: number) {
  const { data } = await s.rpc('nextval', { seq_name: 'trainer_invoice_seq' }).single().catch(() => ({ data: null }))
  // Si pas de RPC nextval, on compte les factures de l'année + 1
  if (!data) {
    const { count } = await s.from('trainer_invoices')
      .select('*', { count: 'exact', head: true })
      .eq('period_year', year)
    const n = (count ?? 0) + 1
    return `CFP-TR-${year}-${String(n).padStart(4, '0')}`
  }
  return `CFP-TR-${year}-${String(data).padStart(4, '0')}`
}

async function nextCfaInvoiceNumber(s: any, year: number) {
  const { count } = await s.from('cfa_invoices')
    .select('*', { count: 'exact', head: true })
    .eq('period_year', year)
  const n = (count ?? 0) + 1
  return `CFP-FC-${year}-${String(n).padStart(4, '0')}`
}

// ─────────────── FORMATEURS ───────────────

/**
 * Génère la facture mensuelle du formateur courant.
 * Reprend toutes les heures validées sur la période qui ne sont pas encore
 * rattachées à une facture.
 */
export async function generateMyMonthlyInvoice(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) redirect('/login')
  const { data: trainer } = await s.from('trainers').select('*').eq('user_id', user.id).single()
  if (!trainer) return

  const year = Number(formData.get('year'))
  const month = Number(formData.get('month'))
  if (!year || !month) return
  const { from, to } = monthRange(year, month)

  // Vérifier qu'il n'y a pas déjà une facture pour ce mois
  const { data: existing } = await s.from('trainer_invoices')
    .select('id').eq('trainer_id', trainer.id).eq('period_year', year).eq('period_month', month).maybeSingle()
  if (existing) redirect(`/invoices/${existing.id}`)

  // Récupérer les heures validées sur la période, non encore facturées
  const { data: entries } = await s.from('time_entries')
    .select(`id, work_date, hours_actual,
      session:mission_sessions(mission_id, cfa_id,
        mission:missions(name, trainer_hourly_rate, cfa:cfa(name)),
        cfa:cfa(name))`)
    .eq('trainer_id', trainer.id)
    .eq('status', 'validated')
    .gte('work_date', from)
    .lte('work_date', to)
    .is('trainer_invoice_id', null)

  if (!entries || entries.length === 0) {
    redirect('/invoices?empty=1')
  }

  // Totaux
  let totalHours = 0
  let totalHt = 0
  const lines = entries.map((e: any) => {
    const h = Number(e.hours_actual ?? 0)
    const rate = Number(e.session?.mission?.trainer_hourly_rate ?? trainer.hourly_rate_default ?? 0)
    const amt = Math.round(h * rate * 100) / 100
    totalHours += h
    totalHt += amt
    return {
      time_entry_id: e.id,
      session_date: e.work_date,
      cfa_name: e.session?.mission?.cfa?.name ?? e.session?.cfa?.name ?? '—',
      mission_name: e.session?.mission?.name ?? null,
      hours: h,
      hourly_rate: rate,
      amount_ht: amt,
    }
  })

  const vatRate = trainer.vat_number ? 20 : 0 // auto-entrepreneur sans TVA = 0 ; sinon 20%
  const vatAmount = Math.round(totalHt * vatRate) / 100
  const totalTtc = totalHt + vatAmount

  const invoiceNumber = await nextTrainerInvoiceNumber(s, year)

  const { data: invoice, error } = await s.from('trainer_invoices').insert({
    trainer_id: trainer.id,
    period_year: year,
    period_month: month,
    invoice_number: invoiceNumber,
    total_hours: totalHours,
    hourly_rate: trainer.hourly_rate_default ?? null,
    amount_ht: totalHt,
    vat_rate: vatRate,
    amount_vat: vatAmount,
    amount_ttc: totalTtc,
    status: 'sent',  // envoyée à l'admin pour règlement direct
    created_by: user.id,
  }).select('id').single()

  if (error || !invoice) {
    return redirect('/invoices?error=' + encodeURIComponent(error?.message ?? 'unknown'))
  }

  // Lignes
  await s.from('trainer_invoice_lines').insert(lines.map(l => ({ ...l, invoice_id: invoice.id })))

  // Marquer les time_entries comme facturées
  await s.from('time_entries').update({ trainer_invoice_id: invoice.id })
    .in('id', entries.map((e: any) => e.id))

  revalidatePath('/invoices')
  revalidatePath('/invoicing')
  redirect(`/invoices/${invoice.id}`)
}

export async function deleteMyDraftInvoice(formData: FormData) {
  const s = createClient()
  const id = formData.get('id') as string
  if (!id) return
  // Les RLS filtrent : seulement si c'est à moi + draft
  // Détacher les time_entries avant suppression
  await s.from('time_entries').update({ trainer_invoice_id: null }).eq('trainer_invoice_id', id)
  await s.from('trainer_invoices').delete().eq('id', id)
  revalidatePath('/invoices')
}

// ─────────────── CFA (admin) ───────────────

export async function generateCfaInvoice(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) redirect('/login')

  const cfa_id = formData.get('cfa_id') as string
  const year = Number(formData.get('year'))
  const month = Number(formData.get('month'))
  if (!cfa_id || !year || !month) return
  const { from, to } = monthRange(year, month)

  const { data: existing } = await s.from('cfa_invoices')
    .select('id').eq('cfa_id', cfa_id).eq('period_year', year).eq('period_month', month).maybeSingle()
  if (existing) redirect(`/invoicing/cfa/${existing.id}`)

  // Récupérer heures validées pour ce CFA sur la période, non encore facturées côté CFA
  const { data: entries } = await s.from('time_entries')
    .select(`id, work_date, hours_actual,
      trainer:trainers(first_name, last_name),
      session:mission_sessions(mission_id, cfa_id,
        mission:missions(name, cfa_hourly_rate, cfa_id))`)
    .eq('status', 'validated')
    .gte('work_date', from)
    .lte('work_date', to)
    .is('cfa_invoice_id', null)

  // Filtrer côté app par cfa_id (via session OU mission)
  const filtered = (entries ?? []).filter((e: any) =>
    e.session?.cfa_id === cfa_id || e.session?.mission?.cfa_id === cfa_id
  )
  if (filtered.length === 0) redirect(`/invoicing?empty=1&cfa=${cfa_id}&year=${year}&month=${month}`)

  let totalHours = 0, totalHt = 0
  const lines = filtered.map((e: any) => {
    const h = Number(e.hours_actual ?? 0)
    const rate = Number(e.session?.mission?.cfa_hourly_rate ?? 0)
    const amt = Math.round(h * rate * 100) / 100
    totalHours += h; totalHt += amt
    return {
      time_entry_id: e.id,
      session_date: e.work_date,
      trainer_name: `${e.trainer?.first_name ?? ''} ${e.trainer?.last_name ?? ''}`.trim(),
      mission_name: e.session?.mission?.name ?? null,
      hours: h,
      hourly_rate: rate,
      amount_ht: amt,
    }
  })

  const vatRate = 20
  const vatAmount = Math.round(totalHt * vatRate) / 100
  const totalTtc = totalHt + vatAmount

  const invoiceNumber = await nextCfaInvoiceNumber(s, year)

  const { data: invoice, error } = await s.from('cfa_invoices').insert({
    cfa_id,
    period_year: year,
    period_month: month,
    invoice_number: invoiceNumber,
    total_hours: totalHours,
    amount_ht: totalHt,
    vat_rate: vatRate,
    amount_vat: vatAmount,
    amount_ttc: totalTtc,
    status: 'draft',
    created_by: user.id,
  }).select('id').single()
  if (error || !invoice) redirect('/invoicing?error=' + encodeURIComponent(error?.message ?? 'unknown'))

  await s.from('cfa_invoice_lines').insert(lines.map(l => ({ ...l, invoice_id: invoice.id })))
  await s.from('time_entries').update({ cfa_invoice_id: invoice.id })
    .in('id', filtered.map((e: any) => e.id))

  revalidatePath('/invoicing')
  redirect(`/invoicing/cfa/${invoice.id}`)
}

// ─────────────── Marquage statut (admin) ───────────────

export async function markInvoicePaid(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  const id = formData.get('id') as string
  const type = formData.get('type') as string
  const reference = (formData.get('reference') as string) || null
  if (!id || !['trainer','cfa'].includes(type)) return
  const table = type === 'trainer' ? 'trainer_invoices' : 'cfa_invoices'
  await s.from(table).update({
    status: 'paid',
    paid_at: new Date().toISOString(),
    paid_by: user?.id,
    payment_reference: reference,
  }).eq('id', id)
  revalidatePath('/invoicing')
  revalidatePath('/invoices')
}

export async function markInvoiceSent(formData: FormData) {
  const s = createClient()
  const id = formData.get('id') as string
  const type = formData.get('type') as string
  if (!id || !['trainer','cfa'].includes(type)) return
  const table = type === 'trainer' ? 'trainer_invoices' : 'cfa_invoices'
  await s.from(table).update({ status: 'sent' }).eq('id', id)
  revalidatePath('/invoicing')
  revalidatePath('/invoices')
}

export async function cancelInvoice(formData: FormData) {
  const s = createClient()
  const id = formData.get('id') as string
  const type = formData.get('type') as string
  if (!id || !['trainer','cfa'].includes(type)) return
  const table = type === 'trainer' ? 'trainer_invoices' : 'cfa_invoices'
  // Détacher les time_entries
  const col = type === 'trainer' ? 'trainer_invoice_id' : 'cfa_invoice_id'
  await s.from('time_entries').update({ [col]: null }).eq(col, id)
  await s.from(table).update({ status: 'cancelled' }).eq('id', id)
  revalidatePath('/invoicing')
  revalidatePath('/invoices')
}
