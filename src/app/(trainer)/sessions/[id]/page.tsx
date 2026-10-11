import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtHours, requireTrainer } from '@/lib/utils'
import { submitTimeEntry } from '@/actions/entries'
import { updateMySession } from '@/actions/sessions'
import { notFound } from 'next/navigation'
import { PedagogyPicker } from '@/components/PedagogyPicker'
import { SessionDocuments } from '@/components/SessionDocuments'

export const dynamic = 'force-dynamic'

export default async function SessionEditPage({ params }: { params: { id: string } }) {
 const { trainer } = await requireTrainer()
 const s = createClient()

 const { data: session } = await s.from('mission_sessions')
 .select(`*, mission:missions(name, formation_id, cfa:cfa(name)), time_entries(*)`)
 .eq('id', params.id).single()

 if (!session || session.trainer_id !== trainer?.id) notFound()

 // On charge TOUTES les formations (avec blocs + compétences) pour alimenter le picker,
 // mais on verrouille la formation à celle de la mission si présente.
 const { data: formationsRaw } = await s.from('formations')
 .select('id, code, name, competence_blocks(id, number, title, skills(id, number, label))')
 .is('archived_at', null)
 .order('name')

 const formations = (formationsRaw ?? []).map((f: any) => ({
 id: f.id,
 code: f.code,
 name: f.name,
 blocks: (f.competence_blocks ?? [])
 .sort((a: any, b: any) => a.number - b.number)
 .map((b: any) => ({
 id: b.id,
 number: b.number,
 title: b.title,
 skills: (b.skills ?? []).sort((a: any, b: any) => a.number - b.number),
 })),
 }))

 const existing = session.time_entries?.[0]
 const disabled = existing?.status === 'validated'
 const initialBlockNumber: number | undefined = (existing?.competence_blocks_targeted ?? [])[0]
 const initialSkillIds: string[] = existing?.skill_ids ?? []

 return (
 <div>
 <PageHeader title={`Saisir la séance du ${fmtDate(session.session_date)}`}
 subtitle={`${session.mission?.cfa?.name} · ${session.mission?.name} · Prévu ${session.start_time?.slice(0,5)}-${session.end_time?.slice(0,5)} (${fmtHours(Number(session.hours_planned))})`} />

 {disabled && <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded mb-4 text-sm">Cette saisie a été validée par l'administration et ne peut plus être modifiée.</div>}
 {existing?.status === 'refused' && <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded mb-4 text-sm">Refusée. Motif : {existing.admin_comment}. Vous pouvez re-soumettre.</div>}

 {/* Édition date/horaires/salle de la séance */}
 <form action={updateMySession} className="card mb-5">
 <input type="hidden" name="session_id" value={session.id} />
 <div className="card-header">
 <div>
 <div className="card-title">Date, horaires et salle</div>
 <div className="text-xs text-gray-500 mt-0.5">Corrigez ces infos si la séance a eu lieu à un autre moment. Toute modification repasse la saisie validée en « à re-valider » par l'admin.</div>
 </div>
 </div>
 <div className="card-body grid grid-cols-2 md:grid-cols-5 gap-3">
 <div className="field"><label>Date</label><input name="session_date" type="date" defaultValue={session.session_date} required /></div>
 <div className="field"><label>Heure début</label><input name="start_time" type="time" defaultValue={session.start_time?.slice(0,5)} required /></div>
 <div className="field"><label>Heure fin</label><input name="end_time" type="time" defaultValue={session.end_time?.slice(0,5)} required /></div>
 <div className="field"><label>Pause (min)</label><input name="break_minutes" type="number" defaultValue={session.break_minutes} /></div>
 <div className="field"><label>Salle</label><input name="room" defaultValue={session.room ?? ''} /></div>
 <div className="md:col-span-5 flex justify-end">
 <button className="btn btn-sm btn-outline">Enregistrer les horaires</button>
 </div>
 </div>
 </form>

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
 <PedagogyPicker
 formations={formations}
 fixedFormationId={session.mission?.formation_id ?? null}
 initialBlockNumber={initialBlockNumber}
 initialSkillIds={initialSkillIds}
 />
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
 <button className="btn btn-primary">Soumettre pour validation</button>
 </div>
 )}
 </form>

 <div className="mt-5">
 {/* @ts-expect-error async server component */}
 <SessionDocuments sessionId={session.id} readOnly={disabled} />
 </div>
 </div>
 )
}
