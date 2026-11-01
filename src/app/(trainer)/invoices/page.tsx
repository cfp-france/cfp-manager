import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { requireTrainer, fmtDate, fmtEuro, fmtHours } from '@/lib/utils'
import { generateMyMonthlyInvoice, deleteMyDraftInvoice } from '@/actions/invoices'
import { closeMyMonth } from '@/actions/month-closures'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

export default async function TrainerInvoicesPage({ searchParams }: { searchParams: { empty?: string; error?: string; toast?: string } }) {
 const { trainer } = await requireTrainer()
 if (!trainer) return <div className="card p-6 text-sm">Pas de fiche formateur liée à votre compte.</div>
 const s = createClient()

 const { data: invoices } = await s.from('trainer_invoices')
 .select('*').eq('trainer_id', trainer.id)
 .order('period_year', { ascending: false }).order('period_month', { ascending: false })

 const { data: closures } = await s.from('trainer_month_closures')
 .select('*').eq('trainer_id', trainer.id)
 .order('period_year', { ascending: false }).order('period_month', { ascending: false })

 // Toutes les séances soumises OU validées, pour détecter les mois travaillés
 const { data: entries } = await s.from('time_entries')
 .select('id, work_date, hours_actual, status, session:mission_sessions(mission:missions(trainer_hourly_rate))')
 .eq('trainer_id', trainer.id)
 .in('status', ['submitted', 'validated'])
 .order('work_date', { ascending: false })

 // Grouper par année/mois — tous les mois travaillés (soumis + validés)
 const groups: Record<string, { hours: number; amount: number; year: number; month: number; hasValidated: boolean }> = {}
 for (const e of entries ?? []) {
 const d = new Date((e as any).work_date)
 const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1
 const key = `${y}-${m}`
 const h = Number((e as any).hours_actual ?? 0)
 const rate = Number((e as any).session?.mission?.trainer_hourly_rate) || Number((trainer as any).hourly_rate_default) || 0
 if (!groups[key]) groups[key] = { hours: 0, amount: 0, year: y, month: m, hasValidated: false }
 groups[key].hours += h
 groups[key].amount += h * rate
 if ((e as any).status === 'validated') groups[key].hasValidated = true
 }
 const closureMap = new Map((closures ?? []).map((c: any) => [`${c.period_year}-${c.period_month}`, c]))
 const monthsWorked = Object.values(groups).sort((a, b) => (b.year - a.year) || (b.month - a.month))

 const now = new Date()
 const curY = now.getUTCFullYear(), curM = now.getUTCMonth() + 1

 return (
 <div>
 <PageHeader
 title="Mes factures"
 subtitle="Générez une facture mensuelle à partir de vos heures validées. Vous pourrez l'imprimer ou la télécharger en PDF."
 />

 {searchParams.empty === '1' && (
 <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded mb-4 text-sm">
 Aucune heure validée sur ce mois (ou déjà toutes facturées).
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

 {/* Clôture mensuelle — nouveau workflow */}
 <div className="card mb-5">
 <div className="card-header">
 <div>
 <div className="card-title">📅 Clôture de mes mois travaillés</div>
 <div className="text-xs text-gray-500 mt-0.5">
 À la fin du mois, une fois toutes vos séances saisies, cliquez sur <b>« Clôturer ce mois »</b>.
 Cela indique à l'administration que votre saisie est complète et qu'elle peut procéder au règlement.
 </div>
 </div>
 </div>
 <div className="card-body space-y-2">
 {monthsWorked.length === 0 && (
 <div className="text-sm text-gray-600 py-2">
 Aucun mois travaillé pour l'instant. Saisissez d'abord vos séances dans « Mes séances ».
 </div>
 )}
 {monthsWorked.map(g => {
 const closure: any = closureMap.get(`${g.year}-${g.month}`)
 const isCurrent = g.year === curY && g.month === curM
 return (
 <div key={`${g.year}-${g.month}`}
 className={`flex items-center justify-between gap-3 p-3 rounded border ${closure ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
 <div className="flex-1">
 <div className="font-semibold text-sm">{MONTHS[g.month - 1]} {g.year}</div>
 <div className="text-xs text-gray-700">
 {fmtHours(g.hours)} saisies · {fmtEuro(g.amount)} HT estimé
 {!g.hasValidated && <span className="ml-2 text-amber-700">· en attente de validation admin</span>}
 </div>
 {closure && (
 <div className="text-xs mt-1">
 <span className="text-green-800 font-semibold">
 ✓ Mois clôturé le {new Date(closure.closed_at).toLocaleDateString('fr-FR')}
 {closure.closed_by_admin && ' (par l\'administration)'}
 </span>
 {closure.paid_at && (
 <span className="ml-2 text-green-800">
 · 💰 Payé le {new Date(closure.paid_at).toLocaleDateString('fr-FR')}
 {closure.payment_reference && ` (${closure.payment_reference})`}
 </span>
 )}
 {!closure.paid_at && <span className="ml-2 text-amber-700">· en attente de règlement</span>}
 </div>
 )}
 </div>
 {!closure && !isCurrent && (
 <form action={closeMyMonth}>
 <input type="hidden" name="year" value={g.year} />
 <input type="hidden" name="month" value={g.month} />
 <button className="btn btn-sm btn-primary">Clôturer ce mois</button>
 </form>
 )}
 {!closure && isCurrent && (
 <span className="text-xs text-gray-500 italic">Mois en cours</span>
 )}
 </div>
 )
 })}
 </div>
 </div>

 {/* Factures à générer (optionnel — ancien workflow) */}
 {monthsWorked.filter(g => g.hasValidated && !closureMap.get(`${g.year}-${g.month}`)?.paid_at).length > 0 && (
 <details className="card mb-5">
 <summary className="card-header cursor-pointer select-none">
 <div>
 <div className="card-title">📄 Générer une facture PDF (optionnel)</div>
 <div className="text-xs text-gray-500 mt-0.5">
 Si vous avez besoin d'une facture PDF formelle à transmettre à votre comptable.
 </div>
 </div>
 </summary>
 <div className="card-body space-y-2">
 {monthsWorked.filter(g => g.hasValidated).map(g => (
 <form key={`${g.year}-${g.month}`} action={generateMyMonthlyInvoice}
 className="flex items-center justify-between gap-3 p-2 bg-brand-light/30 rounded">
 <input type="hidden" name="year" value={g.year} />
 <input type="hidden" name="month" value={g.month} />
 <div className="flex-1">
 <div className="font-semibold text-sm">{MONTHS[g.month - 1]} {g.year}</div>
 <div className="text-xs text-gray-600">{fmtHours(g.hours)} à facturer · {fmtEuro(g.amount)} HT</div>
 </div>
 <button className="btn btn-sm btn-primary"> Générer la facture</button>
 </form>
 ))}
 </div>
 </details>
 )}

 {/* Historique des factures */}
 <div className="card">
 <div className="card-header"><div className="card-title">Historique de mes factures</div></div>
 <div className="card-body p-0">
 <table className="w-full">
 <thead><tr><th>N°</th><th>Période</th><th>Émise le</th><th>Montant HT</th><th>Montant TTC</th><th>Statut</th><th></th></tr></thead>
 <tbody>
 {(invoices ?? []).map((inv: any) => (
 <tr key={inv.id}>
 <td className="font-mono text-xs">{inv.invoice_number}</td>
 <td className="text-sm">{MONTHS[inv.period_month - 1]} {inv.period_year}</td>
 <td className="text-xs">{fmtDate(inv.issue_date)}</td>
 <td>{fmtEuro(Number(inv.amount_ht))}</td>
 <td className="font-semibold">{fmtEuro(Number(inv.amount_ttc))}</td>
 <td>
 {inv.status === 'draft' && <span className="status status-pending">Brouillon</span>}
 {inv.status === 'sent' && <span className="status status-pending">En cours de traitement</span>}
 {inv.status === 'paid' && <span className="status status-validated"> Payée</span>}
 {inv.status === 'cancelled' && <span className="status status-refused">Annulée</span>}
 </td>
 <td className="flex gap-1">
 <Link href={`/invoices/${inv.id}`} className="btn btn-sm btn-outline">Voir</Link>
 {inv.status === 'draft' && (
 <form action={deleteMyDraftInvoice}>
 <input type="hidden" name="id" value={inv.id} />
 <button className="btn btn-sm btn-danger" title="Supprimer le brouillon">Supprimer</button>
 </form>
 )}
 </td>
 </tr>
 ))}
 {(!invoices || invoices.length === 0) && (
 <tr><td colSpan={7} className="text-center text-gray-500 py-6 text-sm">Aucune facture générée pour l'instant.</td></tr>
 )}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 )
}
