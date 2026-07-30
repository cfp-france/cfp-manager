import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtHours, requireTrainer } from '@/lib/utils'
import { submitTimeEntry } from '@/actions/entries'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function SessionEditPage({ params }: { params: { id: string } }) {
  const { trainer } = await requireTrainer()
  const s = createClient()

  const { data: session } = await s.from('mission_sessions')
    .select(`*, mission:missions(name, formation_id, cfa:cfa(name)), time_entries(*)`)
    .eq('id', params.id).single()

  if (!session || session.trainer_id !== trainer?.id) notFound()

  const { data: blocks } = session.mission?.formation_id
    ? await s.from('competence_blocks').select('id, number, title, skills(id, number, label)').eq('formation_id', session.mission.formation_id).order('number')
    : { data: [] }

  const existing = session.time_entries?.[0]
  const disabled = existing?.status === 'validated'

  return (
    <div>
      <PageHeader title={`Saisir la séance du ${fmtDate(session.session_date)}`}
        subtitle={`${session.mission?.cfa?.name} · ${session.mission?.name} · Prévu ${session.start_time?.slice(0,5)}-${session.end_time?.slice(0,5)} (${fmtHours(Number(session.hours_planned))})`} />

      {disabled && <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded mb-4 text-sm">✓ Cette saisie a été validée par l'administration et ne peut plus être modifiée.</div>}
      {existing?.status === 'refused' && <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded mb-4 text-sm">✗ Refusée. Motif : {existing.admin_comment}. Vous pouvez re-soumettre.</div>}

      <form action={submitTimeEntry} className="space-y-5">
        <input type="hidden" name="session_id" value={session.id} />

        <div className="card">
          <div className="card-header"><div className="card-title">① Heures réellement effectuées</div></div>
          <div className="card-body grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="field"><label>Début effectif *</label><input name="actual_start" type="time" defaultValue={existing?.actual_start ?? session.start_time?.slice(0,5)} required disabled={disabled} /></div>
            <div className="field"><label>Fin effective *</label><input name="actual_end" type="time" defaultValue={existing?.actual_end ?? session.end_time?.slice(0,5)} required disabled={disabled} /></div>
            <div className="field"><label>Pause (min)</label><input name="break_minutes" type="number" defaultValue={existing?.break_minutes ?? session.break_minutes} disabled={disabled} /></div>
            <div className="field md:col-span-4"><label>Motif d'ajustement (si écart &gt; 15 min)</label>
              <input name="adjustment_reason" defaultValue={existing?.adjustment_reason ?? ''} placeholder="Ex : prolongation pédagogique, retard apprenants…" disabled={disabled} /></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">② Déroulé pédagogique (format CFP)</div>
              <div className="text-xs text-gray-500 mt-0.5">Colonnes alignées sur le document « Suivi Déroulé pédagogique ».</div>
            </div>
          </div>
          <div className="card-body space-y-3">
            {blocks && blocks.length > 0 ? (
              <>
                <div>
                  <label className="text-xs font-semibold text-navy">Bloc(s) de compétences ciblé(s)</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {blocks.map((b: any) => {
                      const checked = (existing?.competence_blocks_targeted ?? []).includes(b.number)
                      return (
                        <label key={b.id} className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-md px-3 py-1.5 cursor-pointer hover:bg-brand-light">
                          <input type="checkbox" name="blocks" value={b.number} defaultChecked={checked} disabled={disabled} />
                          <span className="text-sm"><b>Bloc {b.number}</b> — {b.title}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-navy">Compétence(s) visée(s) *</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1 mt-1 max-h-64 overflow-y-auto border border-gray-200 rounded-md p-2">
                    {blocks.flatMap((b: any) => (b.skills ?? []).map((sk: any) => {
                      const checked = (existing?.skill_ids ?? []).includes(sk.id)
                      return (
                        <label key={sk.id} className="flex items-start gap-2 p-1.5 hover:bg-brand-light rounded cursor-pointer text-xs">
                          <input type="checkbox" name="skills" value={sk.id} defaultChecked={checked} disabled={disabled} className="mt-0.5" />
                          <span><b>B{b.number}.{sk.number}</b> {sk.label}</span>
                        </label>
                      )
                    }))}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded text-sm">
                Aucune formation rattachée à cette mission — le référentiel de compétences n'est pas disponible.
                Vous pouvez néanmoins remplir les champs texte ci-dessous.
              </div>
            )}
            <div className="field"><label>Contenu abordé *</label>
              <textarea name="content_covered" rows={2} defaultValue={existing?.content_covered ?? ''} disabled={disabled} placeholder="Détail des chapitres, sujets, cas pratiques" required></textarea></div>
            <div className="field"><label>Supports pédagogiques utilisés</label>
              <textarea name="pedagogical_supports" rows={2} defaultValue={existing?.pedagogical_supports ?? ''} disabled={disabled} placeholder="Ex : Diaporama, étude de cas, jeux de rôle, DST"></textarea></div>
            <div className="field"><label>Travail effectué / Avancement</label>
              <textarea name="work_done" rows={3} defaultValue={existing?.work_done ?? ''} disabled={disabled} placeholder="Simulations, jeux de rôle, analyse, correction…"></textarea></div>
            <div className="field"><label>Commentaire / Points à revoir</label>
              <textarea name="points_to_review" rows={2} defaultValue={existing?.points_to_review ?? ''} disabled={disabled} placeholder="Difficultés rencontrées, points à approfondir"></textarea></div>
            <div className="field"><label>% de complétion du programme</label>
              <input name="program_completion" type="number" min={0} max={100} defaultValue={existing?.program_completion ?? 100} disabled={disabled} /></div>
          </div>
        </div>

        {!disabled && (
          <div className="flex justify-end gap-2">
            <button name="draft" value="1" className="btn btn-outline">Enregistrer en brouillon</button>
            <button className="btn btn-primary">✓ Soumettre pour validation</button>
          </div>
        )}
      </form>
    </div>
  )
}
