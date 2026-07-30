import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtEuro, fmtHours, requireTrainer } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function EarningsPage() {
  const { trainer } = await requireTrainer()
  const s = createClient()
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  const { data: rows } = await s.from('time_entries').select(`*, session:mission_sessions(mission:missions(name, trainer_hourly_rate, cfa:cfa(name)))`)
    .eq('trainer_id', trainer?.id ?? '00000000-0000-0000-0000-000000000000')
    .eq('status', 'validated').gte('work_date', monthStart).order('work_date')

  const total = (rows ?? []).reduce((a: number, r: any) => {
    const rate = Number(r.session?.mission?.trainer_hourly_rate ?? trainer?.hourly_rate_default ?? 0)
    return a + Number(r.hours_actual) * rate
  }, 0)

  return (
    <div>
      <PageHeader title="Mes rémunérations" subtitle="Détail du mois en cours (heures validées uniquement)" />
      <div className="bg-gradient-to-br from-navy to-brand text-white rounded-xl p-6 mb-4 text-center">
        <div className="text-4xl font-bold">{fmtEuro(total)}</div>
        <div className="text-sm opacity-90 mt-1">À facturer à CFP — mois en cours</div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Détail des séances validées</div></div>
        <table className="w-full">
          <thead><tr><th>Date</th><th>Mission</th><th>Heures</th><th>Tarif</th><th>Montant</th></tr></thead>
          <tbody>
            {rows?.map((r: any) => {
              const rate = Number(r.session?.mission?.trainer_hourly_rate ?? trainer?.hourly_rate_default ?? 0)
              return (
                <tr key={r.id}>
                  <td>{fmtDate(r.work_date)}</td>
                  <td><div>{r.session?.mission?.name}</div><div className="text-xs text-gray-500">{r.session?.mission?.cfa?.name}</div></td>
                  <td>{fmtHours(Number(r.hours_actual))}</td>
                  <td>{rate.toFixed(2)} €/h</td>
                  <td className="font-semibold">{fmtEuro(rate * Number(r.hours_actual))}</td>
                </tr>
              )
            })}
            {(!rows || rows.length === 0) && <tr><td colSpan={5} className="text-center text-gray-500 py-8">Aucune séance validée ce mois.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
