import { createClient } from '@/lib/supabase/server'
import { fmtEuro } from '@/lib/utils'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CfaInvoicePrint } from '@/components/CfaInvoicePrint'
import { markInvoicePaid, markInvoiceSent, cancelInvoice, updateCfaInvoiceLineSubject, updateCfaInvoiceLinePromotion, bulkUpdateCfaInvoiceLines, refreshCfaInvoiceDerivedFields } from '@/actions/invoices'

export const dynamic = 'force-dynamic'
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

export default async function AdminCfaInvoicePage({ params, searchParams }: { params: { id: string }; searchParams: { toast?: string } }) {
 const s = createClient()
 const [{ data: inv }, { data: subjects }, { data: promotions }] = await Promise.all([
  s.from('cfa_invoices').select('*, cfa:cfa(*), lines:cfa_invoice_lines(*)').eq('id', params.id).single(),
  s.from('subjects').select('name').order('name'),
  s.from('promotions').select('name').order('name'),
 ])
 if (!inv) notFound()
 const c: any = inv.cfa
 const sortedLines = (inv.lines ?? []).slice().sort((a: any, b: any) => {
  const d = (a.session_date ?? '').localeCompare(b.session_date ?? '')
  return d !== 0 ? d : (a.start_time ?? '').localeCompare(b.start_time ?? '')
 })
 const subjectOptions = (subjects ?? []).map((x: any) => x.name)
 const promotionOptions = (promotions ?? []).map((x: any) => x.name)

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

 {/* Édition promotion + matière (datalist) — masquée à l'impression */}
 <details className="card mb-4 print:hidden" open>
 <summary className="card-header cursor-pointer select-none">
 <div>
 <div className="card-title">✏️ Modifier promotion & matière (apparaît sur la page récap)</div>
 <div className="text-xs text-gray-500 mt-0.5">
 Choisissez dans la liste déroulante ou tapez une nouvelle valeur (elle sera ajoutée au référentiel pour les prochaines factures).
 </div>
 </div>
 </summary>
 <div className="card-body">
 {searchParams.toast && (
  <div className="bg-green-50 border-l-4 border-green-500 p-2 rounded mb-3 text-xs">✓ {searchParams.toast}</div>
 )}
 <datalist id="subjects-list">
 {subjectOptions.map((name: string) => <option key={name} value={name} />)}
 </datalist>
 <datalist id="promotions-list">
 {promotionOptions.map((name: string) => <option key={name} value={name} />)}
 </datalist>

 {/* Auto-remplissage depuis les données source (compétences cochées, mission, formation, etc.) */}
 <div className="flex flex-wrap gap-2 items-center mb-3 p-2 bg-blue-50 rounded border border-blue-200">
 <span className="text-xs text-blue-900">
 💡 Remplir automatiquement les cases vides à partir des compétences cochées par le formateur :
 </span>
 <form action={refreshCfaInvoiceDerivedFields} className="inline">
 <input type="hidden" name="invoice_id" value={inv.id} />
 <button className="btn btn-sm btn-outline">Auto-remplir (cases vides)</button>
 </form>
 <form action={refreshCfaInvoiceDerivedFields} className="inline">
 <input type="hidden" name="invoice_id" value={inv.id} />
 <input type="hidden" name="force" value="1" />
 <button className="btn btn-sm btn-outline" title="Écrase même les cases déjà remplies">Tout re-calculer (écrase)</button>
 </form>
 </div>

 {/* Édition en masse : un seul form englobant les checkboxes + les 2 champs */}
 <form action={bulkUpdateCfaInvoiceLines} className="p-3 bg-brand-light/30 rounded mb-4">
 <input type="hidden" name="invoice_id" value={inv.id} />
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
 <div>
 <label className="text-[11px] font-semibold text-navy block mb-1">Promotion à appliquer</label>
 <input name="promotion" list="promotions-list" placeholder="Ex : BTS_NDRC"
  className="text-sm border rounded px-2 py-1 w-full" />
 </div>
 <div>
 <label className="text-[11px] font-semibold text-navy block mb-1">Matière à appliquer</label>
 <input name="subject" list="subjects-list" placeholder="Ex : Stratégie pro"
  className="text-sm border rounded px-2 py-1 w-full" />
 </div>
 </div>
 <p className="text-[11px] text-gray-600 mb-2">
 Cochez les lignes puis cliquez <b>« Appliquer »</b>. Les champs vides ne sont pas modifiés.
 </p>
 <table className="w-full text-xs mb-3">
 <thead>
 <tr className="bg-gray-100 text-[10px]">
  <th className="p-1 text-left w-6"></th>
  <th className="p-1 text-left">Date / Horaire</th>
  <th className="p-1 text-left">Formateur</th>
  <th className="p-1 text-left">Promotion actuelle</th>
  <th className="p-1 text-left">Matière actuelle</th>
 </tr>
 </thead>
 <tbody>
 {sortedLines.map((l: any) => (
 <tr key={l.id} className="border-b border-gray-100">
 <td className="p-1"><input type="checkbox" name="line_ids" value={l.id} /></td>
 <td className="p-1 whitespace-nowrap">
  <div>{l.session_date}</div>
  <div className="text-gray-500 font-mono text-[10px]">{(l.start_time ?? '').slice(0,5)}-{(l.end_time ?? '').slice(0,5)}</div>
 </td>
 <td className="p-1 font-semibold">{l.trainer_name}</td>
 <td className="p-1 italic text-gray-600">{l.promotion || '—'}</td>
 <td className="p-1 italic text-gray-600">{l.module || '—'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 <button className="btn btn-sm btn-primary">Appliquer aux lignes cochées</button>
 </form>

 {/* Édition ligne par ligne (2 forms indépendants par ligne, pas imbriqués dans table) */}
 <div className="text-[11px] font-semibold text-navy mb-2">Édition ligne par ligne</div>
 <div className="space-y-1">
 {sortedLines.map((l: any) => (
 <div key={l.id} id={`line-${l.id}`} className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 rounded text-xs">
 <span className="w-20 whitespace-nowrap">{l.session_date}</span>
 <span className="w-20 font-mono text-gray-600">{(l.start_time ?? '').slice(0,5)}-{(l.end_time ?? '').slice(0,5)}</span>
 <span className="w-32 font-semibold">{l.trainer_name}</span>
 <form action={updateCfaInvoiceLinePromotion} className="flex gap-1 items-center flex-1 min-w-[180px]">
 <input type="hidden" name="line_id" value={l.id} />
 <input type="hidden" name="invoice_id" value={inv.id} />
 <input name="promotion" list="promotions-list" defaultValue={l.promotion ?? ''}
  placeholder="Promotion" className="text-xs border rounded px-2 py-1 flex-1" />
 <button className="btn btn-sm btn-outline" title="Enregistrer la promotion">💾 Promo</button>
 </form>
 <form action={updateCfaInvoiceLineSubject} className="flex gap-1 items-center flex-1 min-w-[180px]">
 <input type="hidden" name="line_id" value={l.id} />
 <input type="hidden" name="invoice_id" value={inv.id} />
 <input name="subject" list="subjects-list" defaultValue={l.module ?? ''}
  placeholder="Matière" className="text-xs border rounded px-2 py-1 flex-1" />
 <button className="btn btn-sm btn-outline" title="Enregistrer la matière">💾 Matière</button>
 </form>
 </div>
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
