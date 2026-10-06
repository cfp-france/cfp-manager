import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtEuro, fmtHours } from '@/lib/utils'
import { generateCfaInvoice, markInvoicePaid, cancelInvoice } from '@/actions/invoices'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
const MONTHS = ['Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.']

export default async function InvoicingDashboard({ searchParams }: { searchParams: { empty?: string; error?: string } }) {
  const s = createClient()

  const [{ data: trainerInvoices }, { data: cfaInvoices }, { data: cfas }] = await Promise.all([
    s.from('trainer_invoices')
      .select('*, trainer:trainers(first_name, last_name, company_name)')
      .order('period_year', { ascending: false }).order('period_month', { ascending: false }).limit(100),
    s.from('cfa_invoices')
      .select('*, cfa:cfa(name)')
      .order('period_year', { ascending: false }).order('period_month', { ascending: false }).limit(100),
    s.from('cfa').select('id, name').is('archived_at', null).order('name'),
  ])

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

  // Totaux
  const trPaid = (trainerInvoices ?? []).filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.amount_ttc), 0)
  const trPending = (trainerInvoices ?? []).filter((i: any) => i.status === 'sent' || i.status === 'draft').reduce((s: number, i: any) => s + Number(i.amount_ttc), 0)
  const cfaPaid = (cfaInvoices ?? []).filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.amount_ttc), 0)
  const cfaPending = (cfaInvoices ?? []).filter((i: any) => i.status === 'sent' || i.status === 'draft').reduce((s: number, i: any) => s + Number(i.amount_ttc), 0)

  return (
    <div>
      <PageHeader title="Facturation" subtitle="Factures formateurs reçues, factures CFA émises, suivi des règlements." />

      {searchParams.empty === '1' && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded mb-4 text-sm">
          ⚠ Aucune heure validée disponible pour cette période (ou déjà facturée).
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label="Dû aux formateurs" value={fmtEuro(trPending)} tone="amber" />
        <Kpi label="Déjà payé aux formateurs" value={fmtEuro(trPaid)} tone="green" />
        <Kpi label="En attente CFA" value={fmtEuro(cfaPending)} tone="amber" />
        <Kpi label="Encaissé CFA" value={fmtEuro(cfaPaid)} tone="green" />
      </div>

      {/* Factures CFA à générer */}
      {toGenerate.length > 0 && (
        <div className="card mb-5">
          <div className="card-header">
            <div className="card-title">💡 Nouvelles factures CFA à générer</div>
          </div>
          <div className="card-body space-y-2">
            {toGenerate.map(g => (
              <form key={`${g.cfaId}-${g.year}-${g.month}`} action={generateCfaInvoice}
                className="flex items-center justify-between gap-3 p-2 bg-brand-light/30 rounded">
                <input type="hidden" name="cfa_id" value={g.cfaId} />
                <input type="hidden" name="year" value={g.year} />
                <input type="hidden" name="month" value={g.month} />
                <div className="flex-1">
                  <div className="font-semibold text-sm">{g.cfaName} — {MONTHS[g.month - 1]} {g.year}</div>
                  <div className="text-xs text-gray-600">{fmtHours(g.hours)} · {fmtEuro(g.amount)} HT</div>
                </div>
                <button className="btn btn-sm btn-primary">📄 Générer</button>
              </form>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Factures formateurs (reçues) */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">📥 Factures reçues des formateurs</div>
          </div>
          <div className="card-body p-0">
            <table className="w-full">
              <thead><tr><th>N°</th><th>Formateur</th><th>Période</th><th>TTC</th><th>Statut</th><th></th></tr></thead>
              <tbody>
                {(trainerInvoices ?? []).map((inv: any) => (
                  <tr key={inv.id} className={inv.status === 'sent' ? 'bg-amber-50' : ''}>
                    <td className="font-mono text-[11px]">{inv.invoice_number}</td>
                    <td className="text-xs">{inv.trainer?.company_name || `${inv.trainer?.first_name ?? ''} ${inv.trainer?.last_name ?? ''}`}</td>
                    <td className="text-xs">{MONTHS[inv.period_month - 1]} {inv.period_year}</td>
                    <td className="font-semibold text-sm">{fmtEuro(Number(inv.amount_ttc))}</td>
                    <td>
                      {inv.status === 'draft' && <span className="status status-pending">Brouillon</span>}
                      {inv.status === 'sent' && <span className="status status-pending">En cours</span>}
                      {inv.status === 'paid' && <span className="status status-validated">✓ Payée</span>}
                      {inv.status === 'cancelled' && <span className="status status-refused">Annulée</span>}
                    </td>
                    <td className="flex gap-1">
                      <Link href={`/invoicing/trainer/${inv.id}`} className="btn btn-sm btn-outline">Voir</Link>
                      {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                        <form action={markInvoicePaid} className="flex gap-1">
                          <input type="hidden" name="id" value={inv.id} />
                          <input type="hidden" name="type" value="trainer" />
                          <button className="btn btn-sm btn-success" title="Marquer payée">💶</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {(!trainerInvoices || trainerInvoices.length === 0) && (
                  <tr><td colSpan={6} className="text-center text-gray-500 py-6 text-sm">Aucune facture formateur.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Factures CFA (émises) */}
        <div className="card">
          <div className="card-header"><div className="card-title">📤 Factures émises aux CFA</div></div>
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
                      {inv.status === 'paid' && <span className="status status-validated">✓ Payée</span>}
                      {inv.status === 'cancelled' && <span className="status status-refused">Annulée</span>}
                    </td>
                    <td className="flex gap-1">
                      <Link href={`/invoicing/cfa/${inv.id}`} className="btn btn-sm btn-outline">Voir</Link>
                      {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                        <form action={markInvoicePaid} className="flex gap-1">
                          <input type="hidden" name="id" value={inv.id} />
                          <input type="hidden" name="type" value="cfa" />
                          <button className="btn btn-sm btn-success" title="Marquer payée (encaissée)">💶</button>
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

function Kpi({ label, value, tone }: { label: string; value: string; tone: 'green' | 'amber' }) {
  const bg = tone === 'green' ? 'bg-green-50' : 'bg-amber-50'
  const txt = tone === 'green' ? 'text-green-800' : 'text-amber-800'
  return (
    <div className={`card p-4 ${bg}`}>
      <div className="text-[11px] text-gray-600 font-semibold uppercase tracking-wider">{label}</div>
      <div className={`text-xl font-bold ${txt} mt-1`}>{value}</div>
    </div>
  )
}
