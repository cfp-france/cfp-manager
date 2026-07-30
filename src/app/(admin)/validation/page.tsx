import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtHours } from '@/lib/utils'
import { validateEntry, refuseEntry } from '@/actions/entries'

export const dynamic = 'force-dynamic'

export default async function ValidationPage() {
  const s = createClient()
  const { data: entries } = await s.from('time_entries')
    .select(`*, trainer:trainers(first_name, last_name), session:mission_sessions(session_date, start_time, end_time, hours_planned, mission:missions(name, cfa:cfa(name)))`)
    .eq('status', 'submitted').order('work_date', { ascending: true })

  return (
    <div>
      <PageHeader title="Validation des heures" subtitle={`${entries?.length ?? 0} saisies en attente`} />

      {(entries?.length ?? 0) === 0 && (
        <div className="card p-8 text-center text-gray-500">
          🎉 Aucune saisie en attente. Vous êtes à jour.
        </div>
      )}

      <div className="space-y-3">
        {entries?.map((e: any) => {
          const planned = Number(e.session?.hours_planned ?? 0)
          const actual = Number(e.hours_actual ?? 0)
          const diff = actual - planned
          return (
            <div key={e.id} className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">{fmtDate(e.work_date)} — {e.trainer?.first_name} {e.trainer?.last_name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {e.session?.mission?.cfa?.name} · {e.session?.mission?.name}
                  </div>
                </div>
                <span className="status status-pending">En attente</span>
              </div>
              <div className="card-body grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs font-semibold text-navy mb-2">Heures</div>
                  <div className="text-sm">Prévu : <b>{fmtHours(planned)}</b> · Réel : <b>{fmtHours(actual)}</b></div>
                  {Math.abs(diff) > 0.01 && (
                    <div className={`text-xs mt-1 font-semibold ${diff > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                      Écart : {diff > 0 ? '+' : ''}{fmtHours(Math.abs(diff))}
                    </div>
                  )}
                  {e.adjustment_reason && <div className="text-xs text-gray-500 mt-1"><i>Motif : {e.adjustment_reason}</i></div>}
                </div>
                <div>
                  <div className="text-xs font-semibold text-navy mb-2">Contenu pédagogique</div>
                  <div className="text-xs"><b>Bloc(s) :</b> {(e.competence_blocks_targeted ?? []).join(', ') || '—'}</div>
                  <div className="text-xs mt-1"><b>Contenu :</b> {e.content_covered || '—'}</div>
                  <div className="text-xs mt-1"><b>Supports :</b> {e.pedagogical_supports || '—'}</div>
                  <div className="text-xs mt-1"><b>Travail :</b> {e.work_done || '—'}</div>
                  {e.points_to_review && <div className="text-xs mt-1 bg-amber-50 p-1.5 rounded"><b>À revoir :</b> {e.points_to_review}</div>}
                </div>
                <div>
                  <div className="text-xs font-semibold text-navy mb-2">Actions</div>
                  <form action={validateEntry}>
                    <input type="hidden" name="entry_id" value={e.id} />
                    <button className="btn btn-success btn-sm w-full mb-2">✓ Valider</button>
                  </form>
                  <form action={refuseEntry} className="space-y-1">
                    <input type="hidden" name="entry_id" value={e.id} />
                    <input name="motif" placeholder="Motif de refus" className="w-full text-xs border rounded px-2 py-1" required />
                    <button className="btn btn-danger btn-sm w-full">Refuser</button>
                  </form>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
