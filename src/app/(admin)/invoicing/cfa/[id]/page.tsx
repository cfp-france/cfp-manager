import { createClient } from '@/lib/supabase/server'
import { fmtEuro } from '@/lib/utils'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CfaInvoicePrint } from '@/components/CfaInvoicePrint'
import { markInvoicePaid, markInvoiceSent, cancelInvoice, updateCfaInvoiceLineSubject, bulkUpdateCfaInvoiceSubjects } from '@/actions/invoices'

export const dynamic = 'force-dynamic'
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

export default async function AdminCfaInvoicePage({ params }: { params: { id: string } }) {
 const s = createClient()
 const [{ data: inv }, { data: subjects }] = await Promise.all([
  s.from('cfa_invoices').select('*, cfa:cfa(*), lines:cfa_invoice_lines(*)').eq('id', params.id).single(),
  s.from('subjects').select('name').order('name'),
 ])
 if (!inv) notFound()
 const c: any = inv.cfa
 const sortedLines = (inv.lines ?? []).slice().sort((a: any, b: any) => {
  const d = (a.session_date ?? '').localeCompare(b.session_date ?? '')
  return d !== 0 ? d : (a.start_time ?? '').localeCompare(b.start_time ?? '')
 })
 const subjectOptions = (subjects ?? []).map((x: any) => x.name)

 return (
 <div>
 <div className="flex items-center justify-between gap-2 mb-4 print:hidden flex-wrap">
 <div>
 <h1 className="text-xl font-bold text-navy">Facture CFA {inv.invoice_number}</h1>
 <p className="text-sm text-gray-500">
 {c?.name} — {MONTHS[inv.period_month - 1]} {inv.period_year} — {fmtEuro(Number(inv.amount_ht))} <span className="italic text-gray-400">(exonéré de TVA)</span>
 </p>
 </div>
 <div className="flex gap-2 flex-wrap">
 <Link href="/invoicing" className="btn btn-outline">← Retour</Link>
 {inv.status === 'draft' && (
 <form action={markInvoiceSent}>
 <input type="hidden" name="id" value={inv.id} />
 <input type="hidden" name="type" value="cfa" />
 <button className="btn btn-primary"> Marquer envoyée</button>
 </form>
 )}
 {inv.status !== 'paid' && inv.status !== 'cancelled' && (
 <form action={markInvoicePaid} className="flex gap-2 items-center">
 <input type="hidden" name="id" value={inv.id} />
 <input type="hidden" name="type" value="cfa" />
 <input name="reference" placeholder="N° virement" className="text-sm border rounded px-2 py-1" />
 <button className="btn btn-success"> Encaissée</button>
 </form>
 )}
 {inv.status !== 'cancelled' && (
 <form action={cancelInvoice}>
 <input type="hidden" name="id" value={inv.id} />
 <input type="hidden" name="type" value="cfa" />
 <button className="btn btn-danger">Annuler</button>
 </form>
 )}
 <a href="javascript:window.print()" className="btn btn-primary"> PDF</a>
 </div>
 </div>

 {/* Édition des matières (datalist) — masquée à l'impression */}
 <details className="card mb-4 print:hidden" open>
 <summary className="card-header cursor-pointer select-none">
 <div>
 <div className="card-title">✏️ Modifier les matières (apparaît sur la page récap)</div>
 <div className="text-xs text-gray-500 mt-0.5">
 Choisissez une matière dans la liste déroulante ou tapez-en une nouvelle (elle sera ajoutée au référentiel).
 </div>
 </div>
 </summary>
 <div className="card-body">
 <datalist id="subjects-list">
 {subjectOptions.map((name: string) => <option key={name} value={name} />)}
 </datalist>

 {/* Action en bloc : appliquer la même matière à plusieurs lignes */}
 <form action={bulkUpdateCfaInvoiceSubjects} className="mb-3 p-3 bg-brand-light/30 rounded">
 <input type="hidden" name="invoice_id" value={inv.id} />
 <div className="flex flex-wrap items-end gap-2">
 <div className="flex-1 min-w-[240px]">
 <label className="text-[11px] font-semibold text-navy">Matière à appliquer</label>
 <input name="subject" list="subjects-list" placeholder="Ex : Stratégie pro"
  className="text-sm border rounded px-2 py-1 w-full" />
 </div>
 <button className="btn btn-sm btn-primary" title="Applique cette matière à toutes les lignes cochées">
  Appliquer aux lignes cochées
 </button>
 </div>
 <table className="w-full mt-3 text-xs">
 <thead>
 <tr className="bg-gray-100">
  <th className="p-1 text-left w-6"></th>
  <th className="p-1 text-left">Date</th>
  <th className="p-1 text-left">Formateur</th>
  <th className="p-1 text-left">Horaire</th>
  <th className="p-1 text-left">Promotion</th>
  <th className="p-1 text-left">Matière actuelle</th>
 </tr>
 </thead>
 <tbody>
 {sortedLines.map((l: any) => (
 <tr key={l.id} className="border-b border-gray-100">
  <td className="p-1"><input type="checkbox" name="line_ids" value={l.id} /></td>
  <td className="p-1">{l.session_date}</td>
  <td className="p-1">{l.trainer_name}</td>
  <td className="p-1">{(l.start_time ?? '').slice(0,5)}-{(l.end_time ?? '').slice(0,5)}</td>
  <td className="p-1">{l.promotion || '—'}</td>
  <td className="p-1 italic text-gray-600">{l.module || '—'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </form>

 {/* Édition ligne par ligne */}
 <div className="text-[11px] font-semibold text-navy mb-2">Édition ligne par ligne</div>
 <div className="space-y-1">
 {sortedLines.map((l: any) => (
 <form key={l.id} id={`line-${l.id}`} action={updateCfaInvoiceLineSubject}
   className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 rounded text-xs">
 <input type="hidden" name="line_id" value={l.id} />
 <input type="hidden" name="invoice_id" value={inv.id} />
 <span className="w-20">{l.session_date}</span>
 <span className="w-32 font-semibold">{l.trainer_name}</span>
 <span className="w-20 font-mono">{(l.start_time ?? '').slice(0,5)}-{(l.end_time ?? '').slice(0,5)}</span>
 <span className="w-24">{l.promotion || '—'}</span>
 <input name="subject" list="subjects-list" defaultValue={l.module ?? ''}
  placeholder="Choisir ou saisir une matière"
  className="text-xs border rounded px-2 py-1 flex-1 min-w-[180px]" />
 <button className="btn btn-sm btn-outline">💾 Enregistrer</button>
 </form>
 ))}
 </div>
 </div>
 </details>

 <CfaInvoicePrint
 invoice={inv}
 recipient={{
 name: c?.name,
 address: [c?.address, c?.city].filter(Boolean).join('\n'),
 siret: c?.siret,
 }}
 />
 </div>
 )
}
