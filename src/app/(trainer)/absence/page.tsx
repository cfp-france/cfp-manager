import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, requireTrainer } from '@/lib/utils'
import { submitAbsence } from '@/actions/absences'

export const dynamic = 'force-dynamic'

export default async function AbsencePage() {
  const { trainer } = await requireTrainer()
  const s = createClient()
  const { data: past } = await s.from('trainer_absences').select('*').eq('trainer_id', trainer?.id ?? '00000000-0000-0000-0000-000000000000').order('created_at', { ascending: false })

  return (
    <div>
      <PageHeader title="Déclarer une absence" subtitle="Signalez à l'administration une période où vous ne pourrez pas assurer vos séances." />

      <div className="card mb-6">
        <div className="card-header"><div className="card-title">Nouvelle déclaration</div></div>
        <form action={submitAbsence} className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="field"><label>Date de début *</label><input name="start_date" type="date" required /></div>
          <div className="field"><label>Date de fin *</label><input name="end_date" type="date" required /></div>
          <div className="field md:col-span-2"><label>Motif *</label>
            <select name="reason" required>
              <option value="">— Sélectionner —</option>
              <option value="vacation">Congés</option>
              <option value="sickness">Maladie</option>
              <option value="training">Formation continue</option>
              <option value="personal">Raison personnelle</option>
              <option value="other">Autre</option>
            </select></div>
          <div className="field md:col-span-2"><label>Précisions (optionnel)</label>
            <textarea name="reason_detail" rows={2}></textarea></div>
          <div className="md:col-span-2 flex justify-end"><button className="btn btn-primary">📤 Soumettre la déclaration</button></div>
        </form>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Mes déclarations précédentes</div></div>
        <table className="w-full">
          <thead><tr><th>Période</th><th>Motif</th><th>Séances impactées</th><th>Statut</th></tr></thead>
          <tbody>
            {past?.map((a: any) => (
              <tr key={a.id}>
                <td>{fmtDate(a.start_date)} → {fmtDate(a.end_date)}</td>
                <td>{a.reason}</td>
                <td>{(a.affected_session_ids ?? []).length}</td>
                <td>
                  {a.status === 'submitted' && <span className="status status-pending">En attente</span>}
                  {a.status === 'accepted' && <span className="status status-validated">Acceptée</span>}
                  {a.status === 'refused' && <span className="status status-refused">Refusée</span>}
                </td>
              </tr>
            ))}
            {(!past || past.length === 0) && <tr><td colSpan={4} className="text-center text-gray-500 py-6">Aucune déclaration.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
