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

// FORMATEURS 

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
 .select(`id, session_id, work_date, hours_actual, actual_start, actual_end,
 session:mission_sessions(mission_id, cfa_id, trainer_hourly_rate_override,
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

 // Garde-fou anti-doublons : dédupliquer par session_id (une séance = une seule ligne facturée).
 // Ce n'est pas une dédup "par horaires" qui serait fausse si un formateur fait vraiment
 // 2 séances distinctes dans la journée. On compte UNE SAISIE PAR SÉANCE, point.
 const seenKeys = new Map<string, any>()
 for (const e of entries) {
  const key = (e as any).session_id ?? (e as any).id
  const existing = seenKeys.get(key)
  if (!existing || (e as any).id > existing.id) seenKeys.set(key, e)
 }
 const dedupedEntries = Array.from(seenKeys.values())

 // Totaux
 let totalHours = 0
 let totalHt = 0
 const lines = dedupedEntries.map((e: any) => {
 const h = Number(e.hours_actual ?? 0)
 // Priorité : override séance → tarif mission → tarif par défaut du formateur → 0
 const rate = Number(e.session?.trainer_hourly_rate_override)
   || Number(e.session?.mission?.trainer_hourly_rate)
   || Number(trainer.hourly_rate_default) || 0
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
 status: 'sent', // envoyée à l'admin pour règlement direct
 created_by: user.id,
 }).select('id').single()

 if (error || !invoice) {
 return redirect('/invoices?error=' + encodeURIComponent(error?.message ?? 'unknown'))
 }

 // Lignes
 await s.from('trainer_invoice_lines').insert(lines.map(l => ({ ...l, invoice_id: invoice.id })))

 // Marquer les time_entries comme facturées — on marque TOUTES les entries (y compris les doublons
 // dédupliqués) pour éviter qu'elles ressortent lors de la prochaine facturation.
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

// CFA (admin) 

export async function generateCfaInvoice(formData: FormData) {
 const s = createClient()
 const { data: { user } } = await s.auth.getUser()
 if (!user) redirect('/login')

 const cfa_id = formData.get('cfa_id') as string
 const fromParam = (formData.get('from') as string) || ''
 const toParam = (formData.get('to') as string) || ''
 const yearParam = formData.get('year')
 const monthParam = formData.get('month')
 if (!cfa_id) return

 // Deux modes : plage de dates explicite (from/to) ou mois (year/month)
 let from: string, to: string, year: number, month: number
 if (fromParam && toParam) {
  from = fromParam; to = toParam
  // Pour l'unicité (trainer_id, year, month) : on utilise le mois du milieu de la plage
  const midMs = (new Date(from).getTime() + new Date(to).getTime()) / 2
  const mid = new Date(midMs)
  year = mid.getUTCFullYear()
  month = mid.getUTCMonth() + 1
 } else if (yearParam && monthParam) {
  year = Number(yearParam); month = Number(monthParam)
  const r = monthRange(year, month); from = r.from; to = r.to
 } else {
  return redirect('/invoicing?error=' + encodeURIComponent('Précisez une période (dates ou mois).'))
 }

 const { data: existing } = await s.from('cfa_invoices')
 .select('id').eq('cfa_id', cfa_id).eq('period_year', year).eq('period_month', month).maybeSingle()
 if (existing) redirect(`/invoicing/cfa/${existing.id}`)

 // Récupérer le tarif par défaut du CFA (fallback) + son nom pour la colonne LIEU
 const { data: cfaRow } = await s.from('cfa').select('name, default_hourly_rate').eq('id', cfa_id).single()
 const cfaDefaultRate = Number(cfaRow?.default_hourly_rate ?? 0)
 const cfaName = cfaRow?.name ?? ''

 // Récupérer heures validées pour ce CFA sur la période, non encore facturées côté CFA
 // On exclut aussi les séances dont le trainer actuel est null (séances à pourvoir / déprogrammées)
 // et les séances qui attendent un remplacement — elles ne doivent pas être facturées.
 const { data: entries } = await s.from('time_entries')
 .select(`id, session_id, work_date, hours_actual, actual_start, actual_end, trainer_id,
 trainer:trainers(first_name, last_name, nda),
 session:mission_sessions(id, mission_id, cfa_id, trainer_id, needs_substitution, cfa_hourly_rate_override,
   start_time, end_time, room, declared_class_label, source_template_slot_id,
   formation:formations(code, name),
   cfa:cfa(name),
   mission:missions(name, cfa_hourly_rate, cfa_id, formation:formations(code, name)),
   template:weekly_schedule_slots!source_template_slot_id(label, formation:formations(code, name)))`)
 .eq('status', 'validated')
 .gte('work_date', from)
 .lte('work_date', to)
 .is('cfa_invoice_id', null)

 // Filtrer côté app : CFA correspondant + séance avec un formateur + pas en attente de remplacement
 const preFiltered = (entries ?? []).filter((e: any) => {
  const cfaMatch = e.session?.cfa_id === cfa_id || e.session?.mission?.cfa_id === cfa_id
  if (!cfaMatch) return false
  // Pas de formateur sur la saisie elle-même → non facturable
  if (!e.trainer_id) return false
  // La séance est en attente de remplacement → non facturable (hour "à pourvoir")
  if (e.session?.needs_substitution === true) return false
  // La séance n'a plus de formateur actuel (déprogrammée après coup) → non facturable
  if (e.session && e.session.trainer_id === null) return false
  return true
 })

 // Garde-fou anti-doublons : dédupliquer par session_id (une séance = une seule ligne facturée).
 // Si un formateur fait 2 vraies séances distinctes dans la journée, leurs session_id diffèrent → les 2 sont bien comptées.
 const seenKeys = new Map<string, any>()
 for (const e of preFiltered) {
  const key = (e as any).session_id ?? (e as any).id
  const existing = seenKeys.get(key)
  if (!existing || (e.id > existing.id)) seenKeys.set(key, e)
 }
 const filtered = Array.from(seenKeys.values())
 const dedupSkipped = preFiltered.length - filtered.length
 if (filtered.length === 0) redirect(`/invoicing?empty=1&cfa=${cfa_id}&year=${year}&month=${month}`)

 let totalHours = 0, totalHt = 0
 const lines = filtered.map((e: any) => {
 const h = Number(e.hours_actual ?? 0)
 // Priorité : override séance → tarif mission → tarif CFA par défaut → 0
 const rate = Number(e.session?.cfa_hourly_rate_override)
   || Number(e.session?.mission?.cfa_hourly_rate)
   || cfaDefaultRate
 const amt = Math.round(h * rate * 100) / 100
 totalHours += h; totalHt += amt
 // Promotion = code formation (ex: NTC, REM, BTS_NDRC) ou classe déclarée
 const promotion = e.session?.mission?.formation?.code
   ?? e.session?.formation?.code
   ?? e.session?.template?.formation?.code
   ?? e.session?.declared_class_label
   ?? null
 // Matière = libellé "Intitulé" de la grille hebdo (priorité), puis nom mission
 const moduleName = e.session?.template?.label
   ?? e.session?.mission?.name
   ?? null
 // Lieu = nom du CFA (ou nom raccourci de la session)
 const lieu = e.session?.cfa?.name ?? cfaName
 return {
 time_entry_id: e.id,
 session_date: e.work_date,
 trainer_name: `${e.trainer?.last_name ?? ''} ${e.trainer?.first_name ?? ''}`.trim(),
 trainer_nda: e.trainer?.nda ?? null,
 start_time: e.actual_start ?? e.session?.start_time ?? null,
 end_time: e.actual_end ?? e.session?.end_time ?? null,
 mission_name: moduleName,
 promotion,
 module: moduleName,
 lieu,
 hours: h,
 hourly_rate: rate,
 amount_ht: amt,
 }
 })

 // CFP est exonéré de TVA sur les factures CFA (art. 261-4-4° du CGI, formation professionnelle continue)
 const vatRate = 0
 const vatAmount = 0
 const totalTtc = totalHt

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

/**
 * Met à jour la matière (module) d'UNE ligne de facture CFA.
 * Enregistre aussi la matière dans le référentiel `subjects` si nouvelle.
 */
export async function updateCfaInvoiceLineSubject(formData: FormData) {
 const s = createClient()
 const line_id = formData.get('line_id') as string
 const invoice_id = formData.get('invoice_id') as string
 const subject = ((formData.get('subject') as string) || '').trim() || null
 if (!line_id) return redirect('/invoicing')
 await s.from('cfa_invoice_lines').update({ module: subject }).eq('id', line_id)
 if (subject) {
  await s.from('subjects').insert({ name: subject }).select().maybeSingle().then(() => null).catch(() => null)
 }
 revalidatePath(`/invoicing/cfa/${invoice_id}`)
 redirect(`/invoicing/cfa/${invoice_id}#line-${line_id}`)
}

/**
 * Applique la même matière à PLUSIEURS lignes de la facture CFA en une fois.
 * Pratique pour renseigner d'un coup toutes les séances d'un même formateur.
 */
export async function bulkUpdateCfaInvoiceSubjects(formData: FormData) {
 const s = createClient()
 const invoice_id = formData.get('invoice_id') as string
 const subject = ((formData.get('subject') as string) || '').trim() || null
 const lineIds = formData.getAll('line_ids').map(String).filter(Boolean)
 if (!invoice_id || lineIds.length === 0) return redirect(`/invoicing/cfa/${invoice_id}`)
 await s.from('cfa_invoice_lines').update({ module: subject }).in('id', lineIds)
 if (subject) {
  await s.from('subjects').insert({ name: subject }).select().maybeSingle().then(() => null).catch(() => null)
 }
 revalidatePath(`/invoicing/cfa/${invoice_id}`)
 redirect(`/invoicing/cfa/${invoice_id}`)
}

/**
 * Met à jour la promotion d'UNE ligne de facture CFA + alimente le référentiel.
 */
export async function updateCfaInvoiceLinePromotion(formData: FormData) {
 const s = createClient()
 const line_id = formData.get('line_id') as string
 const invoice_id = formData.get('invoice_id') as string
 const promotion = ((formData.get('promotion') as string) || '').trim() || null
 if (!line_id) return redirect('/invoicing')
 await s.from('cfa_invoice_lines').update({ promotion }).eq('id', line_id)
 if (promotion) {
  await s.from('promotions').insert({ name: promotion }).select().maybeSingle().then(() => null).catch(() => null)
 }
 revalidatePath(`/invoicing/cfa/${invoice_id}`)
 redirect(`/invoicing/cfa/${invoice_id}#line-${line_id}`)
}

/**
 * Applique la même promotion à PLUSIEURS lignes de la facture CFA en une fois.
 */
export async function bulkUpdateCfaInvoicePromotions(formData: FormData) {
 const s = createClient()
 const invoice_id = formData.get('invoice_id') as string
 const promotion = ((formData.get('promotion') as string) || '').trim() || null
 const lineIds = formData.getAll('line_ids').map(String).filter(Boolean)
 if (!invoice_id || lineIds.length === 0) return redirect(`/invoicing/cfa/${invoice_id}`)
 await s.from('cfa_invoice_lines').update({ promotion }).in('id', lineIds)
 if (promotion) {
  await s.from('promotions').insert({ name: promotion }).select().maybeSingle().then(() => null).catch(() => null)
 }
 revalidatePath(`/invoicing/cfa/${invoice_id}`)
 redirect(`/invoicing/cfa/${invoice_id}`)
}

/**
 * Action unifiée bulk : applique promotion ET/OU matière aux lignes cochées.
 * Les champs vides ne sont pas écrits.
 */
export async function bulkUpdateCfaInvoiceLines(formData: FormData) {
 const s = createClient()
 const invoice_id = formData.get('invoice_id') as string
 const promotion = ((formData.get('promotion') as string) || '').trim()
 const subject = ((formData.get('subject') as string) || '').trim()
 const lineIds = formData.getAll('line_ids').map(String).filter(Boolean)
 if (!invoice_id || lineIds.length === 0) return redirect(`/invoicing/cfa/${invoice_id}`)
 const patch: any = {}
 if (promotion) patch.promotion = promotion
 if (subject) patch.module = subject
 if (Object.keys(patch).length === 0) return redirect(`/invoicing/cfa/${invoice_id}`)
 await s.from('cfa_invoice_lines').update(patch).in('id', lineIds)
 if (promotion) await s.from('promotions').insert({ name: promotion }).select().maybeSingle().then(() => null).catch(() => null)
 if (subject) await s.from('subjects').insert({ name: subject }).select().maybeSingle().then(() => null).catch(() => null)
 revalidatePath(`/invoicing/cfa/${invoice_id}`)
 redirect(`/invoicing/cfa/${invoice_id}`)
}

// Facture externe reçue d'un formateur (hors plateforme) ———
// Permet à l'admin d'enregistrer une facture reçue en papier/mail d'un formateur
// qui n'est pas passé par la génération automatique.
export async function recordExternalTrainerInvoice(formData: FormData) {
 const s = createClient()
 const { data: { user } } = await s.auth.getUser()
 if (!user) redirect('/login')

 const trainer_id = formData.get('trainer_id') as string
 const year = Number(formData.get('year'))
 const month = Number(formData.get('month'))
 const amount_ht = Number(formData.get('amount_ht'))
 const vat_rate = Number(formData.get('vat_rate') ?? 0)
 const external_number = (formData.get('external_number') as string) || null
 const already_paid = formData.get('already_paid') === 'on'
 const payment_reference = (formData.get('payment_reference') as string) || null

 if (!trainer_id || !year || !month || !amount_ht) {
  return redirect('/invoicing?error=' + encodeURIComponent('Champs obligatoires manquants.'))
 }

 // Pas 2 factures identiques pour le même formateur / mois
 const { data: existing } = await s.from('trainer_invoices')
  .select('id').eq('trainer_id', trainer_id).eq('period_year', year).eq('period_month', month).maybeSingle()
 if (existing) {
  return redirect('/invoicing?error=' + encodeURIComponent('Une facture existe déjà pour ce formateur et ce mois.'))
 }

 const vatAmount = Math.round(amount_ht * vat_rate) / 100
 const totalTtc = amount_ht + vatAmount
 const invoiceNumber = external_number || await nextTrainerInvoiceNumber(s, year)

 const { data: invoice, error } = await s.from('trainer_invoices').insert({
  trainer_id,
  period_year: year,
  period_month: month,
  invoice_number: invoiceNumber,
  total_hours: 0,
  amount_ht,
  vat_rate,
  amount_vat: vatAmount,
  amount_ttc: totalTtc,
  status: already_paid ? 'paid' : 'sent',
  paid_at: already_paid ? new Date().toISOString() : null,
  paid_by: already_paid ? user.id : null,
  payment_reference: already_paid ? payment_reference : null,
  external_source: true,
  created_by: user.id,
 }).select('id').single()

 if (error || !invoice) {
  return redirect('/invoicing?error=' + encodeURIComponent(error?.message ?? 'Erreur création facture externe'))
 }

 revalidatePath('/invoicing')
 redirect('/invoicing?toast=' + encodeURIComponent('Facture externe enregistrée.'))
}

// Marquage statut (admin)

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
 redirect('/invoicing?toast=' + encodeURIComponent('Facture marquée comme payée.'))
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
