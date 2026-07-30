import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate } from '@/lib/utils'
import { reviewAbsence } from '@/actions/absences'

export const dynamic = 'force-dynamic'

export default async function AbsencesPage() {
  const s = createClient()
  const { data: rows } = await s.from('trainer_absences')
    .select('*, trainer:trainers(first_name, last_name)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <PageHeader title="Absences déclarées" subtitle="Traiter les demandes des formateurs" />
      <div className="card">
        <table className="w-full">
          <thead><tr><th>Formateur</th><th>Période</th><th>Motif</th><th>Séances impactées</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {rows?.map((a: any) => (
              <tr key={a.id}>
                <td className="font-semibold">{a.trainer?.first_name} {a.trainer?.last_name}</td>
                <td>{fmtDate(a.start_date)} → {fmtDate(a.end_date)}</td>
                <td>{labelReason(a.reason)}</td>
                <td>{(a.affected_session_ids ?? []).length} séance(s)</td>
                <td>
                  {a.status === 'submitted' && <span className="status status-pending">À traiter</span>}
                  {a.status === 'accepted' && <span className="status status-validated">Acceptée</span>}
                  {a.status === 'refused' && <span className="status status-refused">Refusée</span>}
                </td>
                <td>
                  {a.status === 'submitted' && (
                    <div className="flex gap-1">
                      <form action={reviewAbsence}>
                        <input type="hidden" name="absence_id" value={a.id} />
                        <input type="hidden" name="decision" value="accepted" />
                        <button className="btn btn-sm btn-success">Accepter</button>
                      </form>
                      <form action={reviewAbsence}>
                        <input type="hidden" name="absence_id" value={a.id} />
                        <input type="hidden" name="decision" value="refused" />
                        <button className="btn btn-sm btn-danger">Refuser</button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {(!rows || rows.length === 0) && <tr><td colSpan={6} className="text-center text-gray-500 py-8">Aucune absence déclarée.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function labelReason(r: string) {
  return ({ vacation: 'Congés', sickness: 'Maladie', training: 'Formation', personal: 'Personnel', other: 'Autre' } as any)[r] ?? r
}
