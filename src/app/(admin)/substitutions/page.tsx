import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate } from '@/lib/utils'
import { assignSubstitute } from '@/actions/substitutions'

export const dynamic = 'force-dynamic'

export default async function SubstitutionsPage() {
  const s = createClient()
  const { data: sessions } = await s.from('mission_sessions')
    .select(`*, mission:missions(name, cfa:cfa(name)),
             original_trainer:trainers!mission_sessions_trainer_id_fkey(first_name, last_name, specialties)`)
    .eq('needs_substitution', true).order('session_date')

  const { data: allTrainers } = await s.from('trainers').select('id, first_name, last_name, specialties, hourly_rate_default').eq('active', true).order('last_name')

  return (
    <div>
      <PageHeader title="Remplacements à pourvoir" subtitle={`${sessions?.length ?? 0} séances à réaffecter`} />

      {(sessions?.length ?? 0) === 0 && (
        <div className="card p-8 text-center text-gray-500">🎉 Aucun remplacement en attente.</div>
      )}

      <div className="space-y-3">
        {sessions?.map((sess: any) => (
          <div key={sess.id} className="card">
            <div className="card-header">
              <div>
                <div className="card-title">📅 {fmtDate(sess.session_date)} — {sess.start_time?.slice(0,5)}-{sess.end_time?.slice(0,5)}</div>
                <div className="text-xs text-gray-500 mt-0.5">{sess.mission?.cfa?.name} · {sess.mission?.name} · {sess.room ?? '—'}</div>
              </div>
              <span className="status status-pending">À pourvoir</span>
            </div>
            <div className="card-body">
              <div className="text-sm mb-3">Formateur initial : <b>{sess.original_trainer?.first_name} {sess.original_trainer?.last_name}</b></div>
              <div className="text-xs font-semibold text-navy mb-2">Formateurs suggérés :</div>
              <form action={assignSubstitute} className="flex gap-2 items-end">
                <input type="hidden" name="session_id" value={sess.id} />
                <div className="field flex-1">
                  <label>Remplaçant</label>
                  <select name="trainer_id" required>
                    <option value="">— Choisir —</option>
                    {allTrainers?.filter(t => t.id !== sess.trainer_id).map(t =>
                      <option key={t.id} value={t.id}>{t.first_name} {t.last_name} ({t.hourly_rate_default ?? '?'}€/h)</option>
                    )}
                  </select>
                </div>
                <button className="btn btn-primary">Confirmer le remplacement</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
