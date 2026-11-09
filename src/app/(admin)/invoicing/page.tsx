import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtEuro, fmtHours } from '@/lib/utils'
import { generateCfaInvoice, markInvoicePaid, cancelInvoice, recordExternalTrainerInvoice } from '@/actions/invoices'
import { markMonthClosurePaid, reopenMonthClosure } from '@/actions/month-closures'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
const MONTHS = ['Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.']

function parseDate(v?: string): string | null {
 if (!v) return null
 return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

export default async function InvoicingDashboard({ searchParams }: { searchParams: { empty?: string; error?: string; toast?: string; from?: string; to?: string; trainer?: string; preset?: string } }) {
 const s = createClient()
 const now = new Date()
 const curY = now.getUTCFullYear()
 const curM = now.getUTCMonth() + 1
 const prevM = curM === 1 ? 12 : curM - 1
 const prevY = curM === 1 ? curY - 1 : curY

 // Filtres période + formateur (défaut = mois précédent, cadence facturation)
 const preset = searchParams.preset ?? 'prev_month'
 let defaultFrom: string, defaultTo: string
 if (preset === 'month') {
  defaultFrom = new Date(curY, curM - 1, 1).toISOString().slice(0,10)
  defaultTo = new Date(curY, curM, 0).toISOString().slice(0,10)
 } else if (preset === 'prev_month') {
  defaultFrom = new Date(prevY, prevM - 1, 1).toISOString().slice(0,10)
  defaultTo = new Date(prevY, prevM, 0).toISOString().slice(0,10)
 } else if (preset === 'year') {
  defaultFrom = `${curY}-01-01`; defaultTo = `${curY}-12-31`
 } else if (preset === 'last90') {
  const d = new Date(); d.setDate(d.getDate() - 90)
  defaultFrom = d.toISOString().slice(0,10); defaultTo = now.toISOString().slice(0,10)
 } else { // all
  defaultFrom = '2020-01-01'; defaultTo = '2099-12-31'
 }
 const from = parseDate(searchParams.from) ?? defaultFrom
 const to = parseDate(searchParams.to) ?? defaultTo
 const trainerFilter = searchParams.trainer && searchParams.trainer !== '' ? searchParams.trainer : null

 const [{ data: trainerInvoices }, { data: cfaInvoices }, { data: cfas }, { data: trainers }, { data: closures }, { data: allEntries }, { data: validatedEntries }] = await Promise.all([
 s.from('trainer_invoices')
 .select('*, trainer:trainers(first_name, last_name, company_name)')
 .order('period_year', { ascending: false }).order('period_month', { ascending: false }).limit(100),
 s.from('cfa_invoices')
 .select('*, cfa:cfa(name)')
 .order('period_year', { ascending: false }).order('period_month', { ascending: false }).limit(100),
 s.from('cfa').select('id, name').is('archived_at', null).order('name'),
 s.from('trainers').select('id, first_name, last_name, company_name').eq('active', true).is('archived_at', null).order('last_name'),
 s.from('trainer_month_closures')
 .select('*, trainer:trainers(id, first_name, last_name, company_name)')
 .order('period_year', { ascending: false }).order('period_month', { ascending: false }).limit(200),
 s.from('time_entries')
 .select('work_date, hours_actual, trainer_id, status, trainer:trainers(id, first_name, last_name, company_name), session:mission_sessions(mission:missions(trainer_hourly_rate))')
 .in('status', ['submitted', 'validated']),
 // Entrées validées pour calcul CA généré (filtrées période + formateur)
 (() => {
  let q = s.from('time_entries')
   .select(`hours_actual, work_date, trainer_id,
    trainer:trainers(hourly_rate_default),
    session:mission_sessions(trainer_hourly_rate_override, cfa_hourly_rate_override,
      mission:missions(trainer_hourly_rate, cfa_hourly_rate, cfa:cfa(id, default_hourly_rate)),
      cfa:cfa(id, default_hourly_rate))`)
   .eq('status', 'validated')
   .gte('work_date', from)
   .lte('work_date', to)
  if (trainerFilter) q = q.eq('trainer_id', trainerFilter)
  return q
 })(),
 ])

 // Les KPIs ne prennent en compte QUE les heures issues de mois CLÔTURÉS
 // (par le formateur ou par l'admin). Clé : trainer_id + année/mois.
 const closedMonthKeys = new Set(
  (closures ?? []).map((c: any) => `${c.trainer_id}-${c.period_year}-${c.period_month}`)
 )

 // KPI CA généré + coût formateur sur la période filtrée (uniquement mois clôturés)
 let caGenere = 0, coutFormateurPeriode = 0
 for (const e of validatedEntries ?? []) {
  const d = new Date((e as any).work_date)
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1
  const key = `${(e as any).trainer_id}-${y}-${m}`
  if (!closedMonthKeys.has(key)) continue // ignorer les heures des mois non clôturés
  const h = Number((e as any).hours_actual ?? 0)
  const se: any = (e as any).session
  const cfaObj = se?.mission?.cfa ?? se?.cfa
  const cfaRate = Number(se?.cfa_hourly_rate_override)
    || Number(se?.mission?.cfa_hourly_rate)
    || Number(cfaObj?.default_hourly_rate) || 0
  const trRate = Number(se?.trainer_hourly_rate_override)
    || Number(se?.mission?.trainer_hourly_rate)
    || Number((e as any).trainer?.hourly_rate_default) || 0
  caGenere += h * cfaRate
  coutFormateurPeriode += h * trRate
 }
 const margePeriode = caGenere - coutFormateurPeriode

 // Mois travaillés par formateur, non encore clôturés — pour que l'admin puisse clôturer à leur place
 const closureKeys = new Set((closures ?? []).map((c: any) => `${c.trainer_id}-${c.period_year}-${c.period_month}`))
 const workedMap: Record<string, { trainerId: string; trainerName: string; year: number; month: number; hours: number; amount: number }> = {}
 for (const e of allEntries ?? []) {
  const d = new Date((e as any).work_date)
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1
  const tid = (e as any).trainer_id
  if (!tid) continue
  const key = `${tid}-${y}-${m}`
  if (closureKeys.has(key)) continue
  const t = (e as any).trainer
  const name = t?.company_name || `${t?.first_name ?? ''} ${t?.last_name ?? ''}`.trim()
  const h = Number((e as any).hours_actual ?? 0)
  const rate = Number((e as any).session?.mission?.trainer_hourly_rate ?? 0)
  if (!workedMap[key]) workedMap[key] = { trainerId: tid, trainerName: name, year: y, month: m, hours: 0, amount: 0 }
  workedMap[key].hours += h
  workedMap[key].amount += h * rate
 }
 // Exclure le mois en cours (le formateur n'est pas censé l'avoir fini)
 const notYetClosed = Object.values(workedMap)
  .filter(w => !(w.year === curY && w.month === curM))
  .filter(w => !trainerFilter || w.trainerId === trainerFilter)
  .sort((a, b) => (b.year - a.year) || (b.month - a.month) || a.trainerName.localeCompare(b.trainerName))

 // Pour l'assistant "Générer facture CFA" : lister les (CFA, mois) avec heures validées non facturées
 const { data: notYet } = await s.from('time_entries')
 .select('work_date, hours_actual, session:mission_sessions(cfa_id, mission:missions(cfa_id, cfa_hourly_rate, cfa:cfa(id, name)))')
 .eq('status', 'validated')
 .is('cfa_invoice_id', null)

 const cfaGroups: Record<string, { cfaId: string; cfaName: string; year: number; month: number; hours: number; amount: number }> = {}
 for (const e of notYet ?? []) {
 const se: any = (e as any).session
 const cfaId = se?.cfa_id ?? se?.mission?.cfa_id
 const cfaName = se?.mission?.cfa?.name ?? '—'
 if (!cfaId) continue
 const d = new Date((e as any).work_date)
 const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1
 const key = `${cfaId}-${y}-${m}`
 const rate = Number(se?.mission?.cfa_hourly_rate ?? 0)
 const h = Number((e as any).hours_actual ?? 0)
 if (!cfaGroups[key]) cfaGroups[key] = { cfaId, cfaName, year: y, month: m, hours: 0, amount: 0 }
 cfaGroups[key].hours += h
 cfaGroups[key].amount += h * rate
 }
 const toGenerate = Object.values(cfaGroups).sort((a, b) => (b.year - a.year) || (b.month - a.month))

 // Helpers : une clôture ou une facture est-elle dans la période filtrée ?
 const inPeriod = (year: number, month: number) => {
  const pStart = `${year}-${String(month).padStart(2,'0')}-01`
  const pEnd = new Date(year, month, 0).toISOString().slice(0,10)
  return pEnd >= from && pStart <= to
 }

 // Filtrage des listes affichées selon formateur sélectionné + période (clôtures / factures)
 const closuresFiltered = (closures ?? []).filter((c: any) =>
  (!trainerFilter || c.trainer_id === trainerFilter) && inPeriod(c.period_year, c.period_month))
 const trainerInvoicesFiltered = (trainerInvoices ?? []).filter((i: any) =>
  (!trainerFilter || i.trainer_id === trainerFilter) && inPeriod(i.period_year, i.period_month))
 const cfaInvoicesInPeriod = (cfaInvoices ?? []).filter((i: any) => inPeriod(i.period_year, i.period_month))

 // KPIs Dû / Payé : scopés au formateur + à la période
 const trPaid = trainerInvoicesFiltered.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.amount_ttc), 0)
 + closuresFiltered.filter((c: any) => c.paid_at).reduce((s: number, c: any) => s + Number(c.total_amount_ht), 0)
 const trPending = trainerInvoicesFiltered.filter((i: any) => i.status === 'sent' || i.status === 'draft').reduce((s: number, i: any) => s + Number(i.amount_ttc), 0)
 + closuresFiltered.filter((c: any) => !c.paid_at).reduce((s: number, c: any) => s + Number(c.total_amount_ht), 0)
 const cfaPaid = cfaInvoicesInPeriod.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.amount_ttc), 0)
 const cfaPending = cfaInvoicesInPeriod.filter((i: any) => i.status === 'sent' || i.status === 'draft').reduce((s: number, i: any) => s + Number(i.amount_ttc), 0)

 return (
 <div>
 <PageHeader title="Facturation" subtitle="Factures formateurs reçues, factures CFA émises, suivi des règlements." />

 {searchParams.empty === '1' && (
 <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded mb-4 text-sm">
 Aucune heure validée disponible pour cette période (ou déjà facturée).
 </div>
 )}
 {searchParams.error && (
 <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded mb-4 text-sm">
 Erreur : {searchParams.error}
 </div>
 )}
 {searchParams.toast && (
 <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded mb-4 text-sm">
 ✓ {searchParams.toast}
 </div>
 )}

 {/* Barre de filtres */}
 <form className="card p-3 mb-4 flex flex-wrap items-end gap-3 bg-brand-light/30">
 <div className="field mb-0">
 <label className="text-[11px] font-semibold text-navy">Période rapide</label>
 <select name="preset" defaultValue={preset} className="text-sm border rounded px-2 py-1">
 <option value="all">Tout l'historique</option>
 <option value="month">Mois en cours</option>
 <option value="prev_month">Mois précédent</option>
 <option value="last90">90 derniers jours</option>
 <option value="year">Année en cours</option>
 <option value="custom">Personnalisée (dates ci-dessous)</option>
 </select>
 </div>
 <div className="field mb-0">
 <label className="text-[11px] font-semibold text-navy">Du</label>
 <input type="date" name="from" defaultValue={from} className="text-sm border rounded px-2 py-1" />
 </div>
 <div className="field mb-0">
 <label className="text-[11px] font-semibold text-navy">Au</label>
 <input type="date" name="to" defaultValue={to} className="text-sm border rounded px-2 py-1" />
 </div>
 <div className="field mb-0 flex-1 min-w-[200px]">
 <label className="text-[11px] font-semibold text-navy">Formateur</label>
 <select name="trainer" defaultValue={trainerFilter ?? ''} className="text-sm border rounded px-2 py-1 w-full">
 <option value="">Tous les formateurs</option>
 {(trainers ?? []).map((t: any) => (
 <option key={t.id} value={t.id}>{t.company_name || `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim()}</option>
 ))}
 </select>
 </div>
 <button className="btn btn-sm btn-primary">Appliquer</button>
 <Link href="/invoicing" className="btn btn-sm btn-outline">Réinitialiser</Link>
 </form>

 <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
 <Kpi label="CA généré" value={fmtEuro(caGenere)} sub="mois clôturés (période)" tone="blue" />
 <Kpi label="Marge brute" value={fmtEuro(margePeriode)} sub="CA − coût formateur" tone={margePeriode >= 0 ? 'green' : 'amber'} />
 <Kpi label="Dû aux formateurs" value={fmtEuro(trPending)} sub="clôtures non payées" tone="amber" />
 <Kpi label="Déjà payé aux formateurs" value={fmtEuro(trPaid)} sub="clôtures réglées" tone="green" />
 <Kpi label="Encaissé / En attente CFA" value={`${fmtEuro(cfaPaid)} / ${fmtEuro(cfaPending)}`} sub="factures CFA" tone="green" />
 </div>

 {/* Clôtures mensuelles formateurs */}
 {(closuresFiltered && closuresFiltered.length > 0) && (
 <div className="card mb-5">
 <div className="card-header">
 <div>
 <div className="card-title">📅 Clôtures mensuelles des formateurs</div>
 <div className="text-xs text-gray-500 mt-0.5">
 Mois clôturés par les formateurs (ou par vous à leur place) — à régler.
 </div>
 </div>
 </div>
 <div className="card-body p-0">
 <table className="w-full">
 <thead><tr><th>Formateur</th><th>Période</th><th>Heures</th><th>Montant HT</th><th>Clôturé</th><th>Statut</th><th></th></tr></thead>
 <tbody>
 {closuresFiltered.map((c: any) => (
 <tr key={c.id} className={c.paid_at ? '' : 'bg-amber-50'}>
 <td className="text-xs">{c.trainer?.company_name || `${c.trainer?.first_name ?? ''} ${c.trainer?.last_name ?? ''}`}</td>
 <td className="text-xs">{MONTHS[c.period_month - 1]} {c.period_year}</td>
 <td className="text-xs">{fmtHours(Number(c.total_hours))}</td>
 <td className="font-semibold text-sm">{fmtEuro(Number(c.total_amount_ht))}</td>
 <td className="text-[11px] text-gray-600">
 {new Date(c.closed_at).toLocaleDateString('fr-FR')}
 {c.closed_by_admin && <span className="ml-1 text-amber-700">(admin)</span>}
 </td>
 <td>
 {c.paid_at ? (
 <span className="status status-validated">💰 Payé</span>
 ) : (
 <span className="status status-pending">À régler</span>
 )}
 </td>
 <td className="flex gap-1">
 {!c.paid_at && (
 <form action={markMonthClosurePaid} className="flex gap-1 items-center">
 <input type="hidden" name="id" value={c.id} />
 <input name="payment_reference" type="text" placeholder="Réf. virement"
 className="text-xs border rounded px-1 py-0.5 w-24" />
 <button className="btn btn-sm btn-success">✓ Payé</button>
 </form>
 )}
 <form action={reopenMonthClosure}>
 <input type="hidden" name="id" value={c.id} />
 <button className="btn btn-sm btn-outline" title="Rouvrir ce mois (annule la clôture)">Rouvrir</button>
 </form>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* Mois travaillés non encore clôturés — l'admin peut clôturer à la place du formateur */}
 {notYetClosed.length > 0 && (
 <details className="card mb-5">
 <summary className="card-header cursor-pointer select-none">
 <div>
 <div className="card-title">⏳ Mois travaillés non encore clôturés par les formateurs ({notYetClosed.length})</div>
 <div className="text-xs text-gray-500 mt-0.5">
 Vous pouvez clôturer un mois à la place d'un formateur s'il tarde à le faire.
 </div>
 </div>
 </summary>
 <div className="card-body space-y-2">
 {notYetClosed.map(w => (
 <Link key={`${w.trainerId}-${w.year}-${w.month}`}
 href={`/invoicing/close/${w.trainerId}/${w.year}/${w.month}`}
 className="flex items-center justify-between gap-3 p-2 bg-brand-light/30 rounded hover:bg-brand-light/60 transition">
 <div className="flex-1">
 <div className="font-semibold text-sm">{w.trainerName} — {MONTHS[w.month - 1]} {w.year}</div>
 <div className="text-xs text-gray-600">{fmtHours(w.hours)} saisies · ~{fmtEuro(w.amount)} HT</div>
 </div>
 <span className="btn btn-sm btn-outline">Vérifier et clôturer →</span>
 </Link>
 ))}
 </div>
 </details>
 )}

 {/* Générer une facture CFA — CFA + période au choix */}
 <div className="card mb-5">
 <div className="card-header">
 <div>
 <div className="card-title">🧾 Générer une facture CFA</div>
 <div className="text-xs text-gray-500 mt-0.5">
 Sélectionnez le CFA et la période. Toutes les heures validées non encore facturées sur cette période seront prises en compte.
 </div>
 </div>
 </div>
 <div className="card-body">
 <form action={generateCfaInvoice} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
 <div className="field mb-0 md:col-span-2">
 <label className="text-[11px] font-semibold text-navy">CFA *</label>
 <select name="cfa_id" required className="text-sm border rounded px-2 py-1 w-full">
 <option value="">— Choisir un CFA —</option>
 {(cfas ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
 </select>
 </div>
 <div className="field mb-0">
 <label className="text-[11px] font-semibold text-navy">Du *</label>
 <input type="date" name="from" required
   defaultValue={new Date(prevY, prevM - 1, 1).toISOString().slice(0,10)}
   className="text-sm border rounded px-2 py-1 w-full" />
 </div>
 <div className="field mb-0">
 <label className="text-[11px] font-semibold text-navy">Au *</label>
 <input type="date" name="to" required
   defaultValue={new Date(prevY, prevM, 0).toISOString().slice(0,10)}
   className="text-sm border rounded px-2 py-1 w-full" />
 </div>
 <button className="btn btn-primary">Générer la facture</button>
 </form>
 {toGenerate.length > 0 && (
 <details className="mt-3">
 <summary className="cursor-pointer text-xs text-gray-600">
 💡 Voir les suggestions automatiques ({toGenerate.length} CFA × mois avec heures validées non facturées)
 </summary>
 <div className="mt-2 space-y-1">
 {toGenerate.map(g => (
 <form key={`${g.cfaId}-${g.year}-${g.month}`} action={generateCfaInvoice}
 className="flex items-center justify-between gap-2 p-2 bg-brand-light/20 rounded text-xs">
 <input type="hidden" name="cfa_id" value={g.cfaId} />
 <input type="hidden" name="year" value={g.year} />
 <input type="hidden" name="month" value={g.month} />
 <div className="flex-1">
 <b>{g.cfaName || '— CFA non défini —'}</b> · {MONTHS[g.month - 1]} {g.year} · {fmtHours(g.hours)} · {fmtEuro(g.amount)} HT
 </div>
 <button className="btn btn-sm btn-outline">Générer</button>
 </form>
 ))}
 </div>
 </details>
 )}
 </div>
 </div>

 {/* Enregistrer une facture externe (reçue hors plateforme) */}
 <details className="card mb-5">
 <summary className="card-header cursor-pointer select-none">
 <div>
 <div className="card-title">➕ Enregistrer une facture externe reçue d'un formateur</div>
 <div className="text-xs text-gray-500 mt-0.5">
 Pour les formateurs qui envoient leur facture en papier/mail sans passer par la plateforme.
 </div>
 </div>
 </summary>
 <div className="card-body">
 <form action={recordExternalTrainerInvoice} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
 <div className="field mb-0">
 <label className="text-[11px] font-semibold text-navy">Formateur *</label>
 <select name="trainer_id" required className="text-sm border rounded px-2 py-1 w-full">
 <option value="">— Sélectionner —</option>
 {(trainers ?? []).map((t: any) => (
 <option key={t.id} value={t.id}>
 {t.company_name || `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim()}
 </option>
 ))}
 </select>
 </div>
 <div className="field mb-0">
 <label className="text-[11px] font-semibold text-navy">Mois concerné *</label>
 <select name="month" required defaultValue={String(prevM)} className="text-sm border rounded px-2 py-1 w-full">
 {MONTHS.map((m, i) => (<option key={i} value={i + 1}>{m}</option>))}
 </select>
 </div>
 <div className="field mb-0">
 <label className="text-[11px] font-semibold text-navy">Année *</label>
 <select name="year" required defaultValue={String(prevY)} className="text-sm border rounded px-2 py-1 w-full">
 {[curY - 1, curY, curY + 1].map(y => (<option key={y} value={y}>{y}</option>))}
 </select>
 </div>
 <div className="field mb-0">
 <label className="text-[11px] font-semibold text-navy">Montant HT (€) *</label>
 <input name="amount_ht" type="number" step="0.01" min="0" required
 className="text-sm border rounded px-2 py-1 w-full" placeholder="0.00" />
 </div>
 <div className="field mb-0">
 <label className="text-[11px] font-semibold text-navy">Taux TVA (%)</label>
 <select name="vat_rate" defaultValue="0" className="text-sm border rounded px-2 py-1 w-full">
 <option value="0">0% (franchise auto-entrepreneur)</option>
 <option value="20">20%</option>
 <option value="10">10%</option>
 <option value="5.5">5,5%</option>
 </select>
 </div>
 <div className="field mb-0">
 <label className="text-[11px] font-semibold text-navy">N° de facture externe</label>
 <input name="external_number" type="text"
 className="text-sm border rounded px-2 py-1 w-full"
 placeholder="Laisser vide = numéro auto" />
 </div>
 <div className="md:col-span-2 lg:col-span-3 bg-brand-light/30 p-3 rounded">
 <label className="flex items-center gap-2 text-sm cursor-pointer">
 <input type="checkbox" name="already_paid" />
 <span>Facture <b>déjà payée</b> (saisir aussi la référence ci-dessous)</span>
 </label>
 <div className="field mb-0 mt-2">
 <label className="text-[11px] font-semibold text-navy">Référence du règlement (si déjà payée)</label>
 <input name="payment_reference" type="text" placeholder="N° virement / chèque / date"
 className="text-sm border rounded px-2 py-1 w-full" />
 </div>
 </div>
 <div className="md:col-span-2 lg:col-span-3 flex justify-end">
 <button className="btn btn-primary">Enregistrer la facture externe</button>
 </div>
 </form>
 </div>
 </details>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 {/* Factures formateurs (reçues) */}
 <div className="card">
 <div className="card-header">
 <div className="card-title"> Factures reçues des formateurs</div>
 </div>
 <div className="card-body p-0">
 <table className="w-full">
 <thead><tr><th>N°</th><th>Formateur</th><th>Période</th><th>TTC</th><th>Statut</th><th></th></tr></thead>
 <tbody>
 {trainerInvoicesFiltered.map((inv: any) => (
 <tr key={inv.id} className={inv.status === 'sent' ? 'bg-amber-50' : ''}>
 <td className="font-mono text-[11px]">{inv.invoice_number}</td>
 <td className="text-xs">{inv.trainer?.company_name || `${inv.trainer?.first_name ?? ''} ${inv.trainer?.last_name ?? ''}`}</td>
 <td className="text-xs">{MONTHS[inv.period_month - 1]} {inv.period_year}</td>
 <td className="font-semibold text-sm">{fmtEuro(Number(inv.amount_ttc))}</td>
 <td>
 {inv.status === 'draft' && <span className="status status-pending">Brouillon</span>}
 {inv.status === 'sent' && <span className="status status-pending">En cours</span>}
 {inv.status === 'paid' && <span className="status status-validated"> Payée</span>}
 {inv.status === 'cancelled' && <span className="status status-refused">Annulée</span>}
 </td>
 <td className="flex gap-1">
 <Link href={`/invoicing/trainer/${inv.id}`} className="btn btn-sm btn-outline">Voir</Link>
 {inv.status !== 'paid' && inv.status !== 'cancelled' && (
 <form action={markInvoicePaid} className="flex gap-1">
 <input type="hidden" name="id" value={inv.id} />
 <input type="hidden" name="type" value="trainer" />
 <button className="btn btn-sm btn-success" title="Marquer comme payée">✓ Payée</button>
 </form>
 )}
 </td>
 </tr>
 ))}
 {trainerInvoicesFiltered.length === 0 && (
 <tr><td colSpan={6} className="text-center text-gray-500 py-6 text-sm">Aucune facture formateur.</td></tr>
 )}
 </tbody>
 </table>
 </div>
 </div>

 {/* Factures CFA (émises) */}
 <div className="card">
 <div className="card-header"><div className="card-title"> Factures émises aux CFA</div></div>
 <div className="card-body p-0">
 <table className="w-full">
 <thead><tr><th>N°</th><th>CFA</th><th>Période</th><th>TTC</th><th>Statut</th><th></th></tr></thead>
 <tbody>
 {(cfaInvoices ?? []).map((inv: any) => (
 <tr key={inv.id} className={inv.status === 'sent' ? 'bg-amber-50' : ''}>
 <td className="font-mono text-[11px]">{inv.invoice_number}</td>
 <td className="text-xs">{inv.cfa?.name}</td>
 <td className="text-xs">{MONTHS[inv.period_month - 1]} {inv.period_year}</td>
 <td className="font-semibold text-sm">{fmtEuro(Number(inv.amount_ttc))}</td>
 <td>
 {inv.status === 'draft' && <span className="status status-pending">Brouillon</span>}
 {inv.status === 'sent' && <span className="status status-pending">Envoyée</span>}
 {inv.status === 'paid' && <span className="status status-validated"> Payée</span>}
 {inv.status === 'cancelled' && <span className="status status-refused">Annulée</span>}
 </td>
 <td className="flex gap-1">
 <Link href={`/invoicing/cfa/${inv.id}`} className="btn btn-sm btn-outline">Voir</Link>
 {inv.status !== 'paid' && inv.status !== 'cancelled' && (
 <form action={markInvoicePaid} className="flex gap-1">
 <input type="hidden" name="id" value={inv.id} />
 <input type="hidden" name="type" value="cfa" />
 <button className="btn btn-sm btn-success" title="Marquer comme encaissée">✓ Encaissée</button>
 </form>
 )}
 </td>
 </tr>
 ))}
 {(!cfaInvoices || cfaInvoices.length === 0) && (
 <tr><td colSpan={6} className="text-center text-gray-500 py-6 text-sm">Aucune facture CFA émise.</td></tr>
 )}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 </div>
 )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: 'green' | 'amber' | 'blue' }) {
 const bg = tone === 'green' ? 'bg-green-50' : tone === 'amber' ? 'bg-amber-50' : 'bg-blue-50'
 const txt = tone === 'green' ? 'text-green-800' : tone === 'amber' ? 'text-amber-800' : 'text-blue-800'
 return (
 <div className={`card p-3 ${bg}`}>
 <div className="text-[11px] text-gray-600 font-semibold uppercase tracking-wider">{label}</div>
 <div className={`text-lg font-bold ${txt} mt-1`}>{value}</div>
 {sub && <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>}
 </div>
 )
}
