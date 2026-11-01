import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtEuro, fmtHours } from '@/lib/utils'
import { closeTrainerMonthAsAdmin } from '@/actions/month-closures'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function monthRange(year: number, month: number) {
  const from = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10)
  const to = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  return { from, to }
}

export default async function CloseMonthReview({ params }: { params: { trainerId: string; year: string; month: string } }) {
  const trainerId = params.trainerId
  const year = Number(params.year)
  const month = Number(params.month)
  if (!trainerId || !year || !month || month < 1 || month > 12) notFound()

  const s = createClient()
  const { from, to } = monthRange(year, month)

  const [{ data: trainer }, { data: entries }, { data: existingClosure }] = await Promise.all([
    s.from('trainers').select('id, first_name, last_name, company_name, hourly_rate_default, vat_number').eq('id', trainerId).single(),
    s.from('time_entries')
      .select(`id, session_id, work_date, actual_start, actual_end, hours_actual, status,
               content_covered, work_done, points_to_review,
               session:mission_sessions(mission:missions(name, trainer_hourly_rate, cfa_hourly_rate, cfa:cfa(name)))`)
      .eq('trainer_id', trainerId)
      .gte('work_date', from)
      .lte('work_date', to)
      .order('work_date')
      .order('actual_start'),
    s.from('trainer_month_closures')
      .select('*').eq('trainer_id', trainerId).eq('period_year', year).eq('period_month', month).maybeSingle(),
  ])

  if (!trainer) notFound()

  const trainerName = (trainer as any).company_name || `${(trainer as any).first_name ?? ''} ${(trainer as any).last_name ?? ''}`.trim()
  const defaultRate = Number((trainer as any).hourly_rate_default ?? 0)

  // Agrégats par statut
  const all = entries ?? []
  const byStatus: Record<string, { count: number; hours: number; amount: number }> = {
    draft: { count: 0, hours: 0, amount: 0 },
    submitted: { count: 0, hours: 0, amount: 0 },
    validated: { count: 0, hours: 0, amount: 0 },
    refused: { count: 0, hours: 0, amount: 0 },
  }
  let caTotal = 0
  for (const e of all) {
    const h = Number((e as any).hours_actual ?? 0)
    const trRate = Number((e as any).session?.mission?.trainer_hourly_rate) || defaultRate
    const cfaRate = Number((e as any).session?.mission?.cfa_hourly_rate ?? 0)
    const st = (e as any).status
    if (byStatus[st]) {
      byStatus[st].count += 1
      byStatus[st].hours += h
      byStatus[st].amount += h * trRate
    }
    if (st === 'validated') caTotal += h * cfaRate
  }

  const validated = byStatus.validated
  const toValidate = byStatus.submitted
  const draft = byStatus.draft
  const refused = byStatus.refused

  const marge = caTotal - validated.amount

  return (
    <div>
      <PageHeader
        title={`Clôture du mois — ${trainerName}`}
        subtitle={`${MONTHS[month - 1]} ${year} · vérification avant clôture définitive`}
      />

      <div className="mb-4">
        <Link href="/invoicing" className="btn btn-sm btn-outline">← Retour à la facturation</Link>
      </div>

      {existingClosure && (
        <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded mb-4 text-sm">
          ✓ Ce mois est <b>déjà clôturé</b> depuis le {new Date((existingClosure as any).closed_at).toLocaleDateString('fr-FR')}
          {(existingClosure as any).paid_at && <> · 💰 payé le {new Date((existingClosure as any).paid_at).toLocaleDateString('fr-FR')}</>}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <Kpi label="Heures validées" value={fmtHours(validated.hours)} sub={`${validated.count} séance(s)`} tone="green" />
        <Kpi label="À régler au formateur" value={fmtEuro(validated.amount)} sub="sur heures validées" tone="green" />
        <Kpi label="CA généré (CFA)" value={fmtEuro(caTotal)} sub="facturable aux CFA" tone="blue" />
        <Kpi label="Marge brute" value={fmtEuro(marge)} sub="CA − formateur" tone={marge >= 0 ? 'green' : 'amber'} />
        <Kpi label="En attente de validation" value={fmtHours(toValidate.hours)} sub={`${toValidate.count} séance(s) soumise(s)`} tone={toValidate.count > 0 ? 'amber' : 'gray'} />
      </div>

      {/* Alertes avant clôture */}
      {toValidate.count > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded mb-4 text-sm">
          ⚠ <b>{toValidate.count} séance(s) soumise(s) non encore validée(s)</b> — elles ne seront pas prises en compte dans le montant à régler.
          Validez-les d'abord si elles sont correctes (menu <i>Validation des heures</i>), ou refusez-les.
        </div>
      )}
      {draft.count > 0 && (
        <div className="bg-gray-50 border-l-4 border-gray-400 p-3 rounded mb-4 text-sm">
          📝 {draft.count} séance(s) en <b>brouillon</b> chez le formateur (non soumise). Pensez à lui demander de les finaliser.
        </div>
      )}
      {refused.count > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded mb-4 text-sm">
          ✗ {refused.count} séance(s) <b>refusée(s)</b>. Si elles doivent être prises en compte, le formateur doit les corriger et re-soumettre.
        </div>
      )}

      {/* Grille détaillée */}
      <div className="card mb-5">
        <div className="card-header">
          <div className="card-title">Détail des séances du mois ({all.length})</div>
        </div>
        <div className="card-body p-0">
          <table className="w-full">
            <thead>
              <tr>
                <th>Date</th>
                <th>Horaires</th>
                <th>Mission / CFA</th>
                <th>Heures</th>
                <th>Taux</th>
                <th>Dû formateur</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {all.map((e: any) => {
                const h = Number(e.hours_actual ?? 0)
                const trRate = Number(e.session?.mission?.trainer_hourly_rate) || defaultRate
                const amt = h * trRate
                return (
                  <tr key={e.id} className={e.status === 'validated' ? '' : e.status === 'refused' ? 'bg-red-50' : 'bg-amber-50'}>
                    <td className="text-xs">{fmtDate(e.work_date)}</td>
                    <td className="text-xs font-mono">{(e.actual_start ?? '').slice(0,5)}–{(e.actual_end ?? '').slice(0,5)}</td>
                    <td className="text-xs">
                      <div className="font-semibold">{e.session?.mission?.name ?? '—'}</div>
                      <div className="text-gray-500">{e.session?.mission?.cfa?.name ?? ''}</div>
                    </td>
                    <td className="text-xs">{fmtHours(h)}</td>
                    <td className="text-xs">{fmtEuro(trRate)}/h</td>
                    <td className="font-semibold text-sm">{fmtEuro(amt)}</td>
                    <td>
                      {e.status === 'draft' && <span className="status status-pending">Brouillon</span>}
                      {e.status === 'submitted' && <span className="status status-pending">Soumise</span>}
                      {e.status === 'validated' && <span className="status status-validated">✓ Validée</span>}
                      {e.status === 'refused' && <span className="status status-refused">✗ Refusée</span>}
                    </td>
                  </tr>
                )
              })}
              {all.length === 0 && (
                <tr><td colSpan={7} className="text-center text-gray-500 py-6 text-sm">Aucune séance sur ce mois.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-brand-light/40 font-semibold">
                <td colSpan={3} className="text-right text-sm pr-2">Total heures validées :</td>
                <td className="text-sm">{fmtHours(validated.hours)}</td>
                <td></td>
                <td className="text-sm">{fmtEuro(validated.amount)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Action de clôture */}
      {!existingClosure && (
        <form action={closeTrainerMonthAsAdmin} className="card bg-brand-light/30">
          <input type="hidden" name="trainer_id" value={trainerId} />
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
          <div className="card-body">
            <div className="font-semibold text-sm mb-1">Clôturer le mois de {trainerName} — {MONTHS[month - 1]} {year}</div>
            <div className="text-xs text-gray-700 mb-3">
              Cette action enregistre le mois comme <b>clôturé</b> ({fmtHours(validated.hours)} validées · <b>{fmtEuro(validated.amount)}</b> à régler).
              Vous pourrez ensuite marquer le règlement comme effectué depuis la page Facturation.
              {toValidate.count > 0 && <> <br /><span className="text-amber-800">⚠ {toValidate.count} séance(s) soumise(s) ne seront pas intégrées car pas encore validée(s).</span></>}
            </div>
            <div className="flex justify-end gap-2">
              <Link href="/invoicing" className="btn btn-sm btn-outline">Annuler</Link>
              <button className="btn btn-sm btn-primary">✓ Clôturer définitivement ce mois</button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: 'green' | 'amber' | 'blue' | 'gray' }) {
  const bg = tone === 'green' ? 'bg-green-50' : tone === 'amber' ? 'bg-amber-50' : tone === 'blue' ? 'bg-blue-50' : 'bg-gray-50'
  const txt = tone === 'green' ? 'text-green-800' : tone === 'amber' ? 'text-amber-800' : tone === 'blue' ? 'text-blue-800' : 'text-gray-700'
  return (
    <div className={`card p-3 ${bg}`}>
      <div className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-bold ${txt} mt-0.5`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>}
    </div>
  )
}
