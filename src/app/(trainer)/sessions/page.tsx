import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtHours, requireTrainer } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function TrainerSessionsPage() {
  const { trainer } = await requireTrainer()
  const s = createClient()
  const { data: sessions } = await s.from('mission_sessions')
    .select(`*, mission:missions(name, cfa:cfa(name)), time_entries(id, status, hours_actual)`)
    .eq('trainer_id', trainer?.id ?? '00000000-0000-0000-0000-000000000000')
    .order('session_date', { ascending: false })

  return (
    <div>
      <PageHeader title="Mes séances" subtitle={`${sessions?.length ?? 0} séances au total`} />
      <div className="card">
        <table className="w-full">
          <thead><tr><th>Date</th><th>Mission</th><th>Horaires</th><th>Prévu</th><th>Statut saisie</th><th>Action</th></tr></thead>
          <tbody>
            {sessions?.map((se: any) => {
              const te = se.time_entries?.[0]
              return (
                <tr key={se.id}>
                  <td className="font-semibold">{fmtDate(se.session_date)}</td>
                  <td><div>{se.mission?.name}</div><div className="text-xs text-gray-500">{se.mission?.cfa?.name}</div></td>
                  <td>{se.start_time?.slice(0,5)}-{se.end_time?.slice(0,5)}</td>
                  <td>{fmtHours(Number(se.hours_planned))}</td>
                  <td>
                    {!te && <span className="status status-pending">À saisir</span>}
                    {te?.status === 'draft' && <span className="status status-pending">Brouillon</span>}
                    {te?.status === 'submitted' && <span className="status status-pending">Soumise</span>}
                    {te?.status === 'validated' && <span className="status status-validated">Validée · {fmtHours(Number(te.hours_actual))}</span>}
                    {te?.status === 'refused' && <span className="status status-refused">Refusée</span>}
                  </td>
                  <td><Link href={`/sessions/${se.id}`} className="btn btn-sm btn-outline">{te?.status === 'validated' ? 'Voir' : 'Saisir'}</Link></td>
                </tr>
              )
            })}
            {(!sessions || sessions.length === 0) && <tr><td colSpan={6} className="text-center text-gray-500 py-8">Vous n'êtes affecté à aucune séance.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
