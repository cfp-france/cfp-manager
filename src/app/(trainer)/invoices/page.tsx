import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { requireTrainer, fmtDate, fmtEuro, fmtHours } from '@/lib/utils'
import { generateMyMonthlyInvoice, deleteMyDraftInvoice } from '@/actions/invoices'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

export default async function TrainerInvoicesPage({ searchParams }: { searchParams: { empty?: string; error?: string } }) {
  const { trainer } = await requireTrainer()
  if (!trainer) return <div className="card p-6 text-sm">Pas de fiche formateur liée à votre compte.</div>
  const s = createClient()

  const { data: invoices } = await s.from('trainer_invoices')
    .select('*').eq('trainer_id', trainer.id)
    .order('period_year', { ascending: false }).order('period_month', { ascending: false })

  // Combien d'heures validées non facturées, par mois ?
  const { data: entries } = await s.from('time_entries')
    .select('id, work_date, hours_actual, session:mission_sessions(mission:missions(trainer_hourly_rate))')
    .eq('trainer_id', trainer.id)
    .eq('status', 'validated')
    .is('trainer_invoice_id', null)
    .order('work_date', { ascending: false })

  // Grouper par année/mois
  const groups: Record<string, { hours: number; amount: number; year: number; month: number }> = {}
  for (const e of entries ?? []) {
    const d = new Date((e as any).work_date)
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1
    const key = `${y}-${m}`
    const h = Number((e as any).hours_actual ?? 0)
    const rate = Number((e as any).session?.mission?.trainer_hourly_rate ?? (trainer as any).hourly_rate_default ?? 0)
    if (!groups[key]) groups[key] = { hours: 0, amount: 0, year: y, month: m }
    groups[key].hours += h
    groups[key].amount += h * rate
  }
  const toInvoice = Object.values(groups).sort((a, b) => (b.year - a.year) || (b.month - a.month))

  return (
    <div>
      <PageHeader
        title="Mes factures"
        subtitle="Générez une facture mensuelle à partir de vos heures validées. Vous pourrez l'imprimer ou la télécharger en PDF."
      />

      {searchParams.empty === '1' && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded mb-4 text-sm">
          ⚠ Aucune heure validée sur ce mois (ou déjà toutes facturées).
        </div>
      )}
      {searchParams.error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded mb-4 text-sm">
          ✗ Erreur : {searchParams.error}
        </div>
      )}

      {/* Factures à générer */}
      {toInvoice.length > 0 && (
        <div className="card mb-5">
          <div className="card-header">
            <div>
              <div className="card-title">💡 Mois disponibles à facturer</div>
              <div className="text-xs text-gray-500 mt-0.5">Toutes vos heures validées non encore facturées.</div>
            </div>
          </div>
          <div className="card-body space-y-2">
            {toInvoice.map(g => (
              <form key={`${g.year}-${g.month}`} action={generateMyMonthlyInvoice}
                className="flex items-center justify-between gap-3 p-2 bg-brand-light/30 rounded">
                <input type="hidden" name="year" value={g.year} />
                <input type="hidden" name="month" value={g.month} />
                <div className="flex-1">
                  <div className="font-semibold text-sm">{MONTHS[g.month - 1]} {g.year}</div>
                  <div className="text-xs text-gray-600">{fmtHours(g.hours)} à facturer · {fmtEuro(g.amount)} HT</div>
                </div>
                <button className="btn btn-sm btn-primary">📄 Générer la facture</button>
              </form>
            ))}
          </div>
        </div>
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
                    {inv.status === 'paid' && <span className="status status-validated">✓ Payée</span>}
                    {inv.status === 'cancelled' && <span className="status status-refused">Annulée</span>}
                  </td>
                  <td className="flex gap-1">
                    <Link href={`/invoices/${inv.id}`} className="btn btn-sm btn-outline">Voir</Link>
                    {inv.status === 'draft' && (
                      <form action={deleteMyDraftInvoice}>
                        <input type="hidden" name="id" value={inv.id} />
                        <button className="btn btn-sm btn-danger" title="Supprimer le brouillon">🗑</button>
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
