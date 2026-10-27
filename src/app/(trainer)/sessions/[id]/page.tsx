import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtHours, requireTrainer } from '@/lib/utils'
import { submitTimeEntry, deleteMyEntry } from '@/actions/entries'
import { requestDeletion, cancelDeletionRequest } from '@/actions/deletion-requests'
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

 // Supabase renvoie parfois time_entries comme un objet (1:1) et parfois comme un tableau (1:N).
 // On normalise et on garde la saisie la plus pertinente (validée > soumise > brouillon > refusée).
 const timeEntriesRaw = session.time_entries
 const timeEntries = Array.isArray(timeEntriesRaw) ? timeEntriesRaw : (timeEntriesRaw ? [timeEntriesRaw] : [])
 const statusPrio = (st: string) => ({ validated: 4, submitted: 3, draft: 2, refused: 1 } as Record<string, number>)[st] ?? 0
 const existing = [...timeEntries].sort((a: any, b: any) => statusPrio(b?.status) - statusPrio(a?.status))[0]
 const disabled = existing?.status === 'validated'

 // Demande de suppression en cours sur cette séance ?
 const { data: pendingDeletion } = await s.from('deletion_requests')
  .select('id, reason, status, admin_comment, created_at')
  .eq('target_type', 'session').eq('target_id', session.id)
  .in('status', ['pending','rejected'])
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
 // Demande de suppression en cours sur la mission liée ?
 const { data: pendingMissionDeletion } = session.mission_id
  ? await s.from('deletion_requests')
    .select('id, reason, status, admin_comment, created_at')
    .eq('target_type', 'mission').eq('target_id', session.mission_id)
    .in('status', ['pending','rejected'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  : { data: null }
 const returnTo = `/sessions/${session.id}`
 const initialBlockNumber: number | undefined = (existing?.competence_blocks_targeted ?? [])[0]
 const initialSkillIds: string[] = existing?.skill_ids ?? []

 return (
 <div>
 <PageHeader title={`Saisir la séance du ${fmtDate(session.session_date)}`}
 subtitle={`${session.mission?.cfa?.name} · ${session.mission?.name} · Prévu ${session.start_time?.slice(0,5)}-${session.end_time?.slice(0,5)} (${fmtHours(Number(session.hours_planned))})`} />

 {disabled && (
  <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded mb-4">
   <div className="flex items-center gap-2 font-semibold text-green-800 text-sm">✓ Saisie VALIDÉE par l'administration</div>
   <div className="text-xs text-green-700 mt-1">Les champs sont verrouillés. Pour toute correction, contactez l'administration pour qu'elle dévalide d'abord la saisie.</div>
  </div>
 )}
 {existing?.status === 'refused' && (
  <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded mb-4">
   <div className="flex items-center gap-2 font-semibold text-red-800 text-sm">✗ Saisie REFUSÉE</div>
   <div className="text-xs text-red-700 mt-1"><b>Motif admin :</b> {existing.admin_comment ?? '—'}</div>
   <div className="text-xs text-red-700 mt-1">Corrigez les informations ci-dessous puis re-soumettez pour validation.</div>
  </div>
 )}
 {existing?.status === 'submitted' && (
  <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded mb-4">
   <div className="flex items-center gap-2 font-semibold text-amber-800 text-sm">⏳ Saisie SOUMISE, en attente de validation admin</div>
   <div className="text-xs text-amber-700 mt-1"><b>Vous pouvez encore la modifier</b> tant qu'elle n'est pas validée : ajoutez des infos ou téléversez des fichiers manquants, puis cliquez sur « Mettre à jour la saisie ». Le statut reste « soumise ».</div>
  </div>
 )}
 {existing?.status === 'draft' && (
  <div className="bg-gray-50 border-l-4 border-gray-400 p-4 rounded mb-4">
   <div className="flex items-center gap-2 font-semibold text-gray-800 text-sm">📝 Brouillon enregistré</div>
   <div className="text-xs text-gray-600 mt-1">Vos données précédentes sont préremplies. Finalisez puis soumettez pour validation.</div>
  </div>
 )}

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

 <form action={submitTimeEntry} encType="multipart/form-data" className="space-y-5">
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
 <div className="field"><label>Supports pédagogiques utilisés (description)</label>
 <textarea name="pedagogical_supports" rows={2} defaultValue={existing?.pedagogical_supports ?? ''} disabled={disabled} placeholder="Ex : Diaporama, étude de cas, jeux de rôle, DST"></textarea></div>

 {!disabled && (
  <div className="field">
   <label>Fichiers de supports à joindre (optionnel)</label>
   <input
    name="pedagogical_files"
    type="file"
    multiple
    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp,.mp4"
    className="w-full text-sm"
   />
   <p className="text-[11px] text-gray-500 mt-1">
    Sélectionnez un ou plusieurs fichiers (max 20 Mo chacun). Ils seront téléversés en même temps que vous soumettez votre saisie — <b>vos informations saisies seront préservées</b>.
   </p>
  </div>
 )}
 <div className="field"><label>Travail effectué / Avancement</label>
 <textarea name="work_done" rows={3} defaultValue={existing?.work_done ?? ''} disabled={disabled} placeholder="Simulations, jeux de rôle, analyse, correction…"></textarea></div>
 <div className="field"><label>Commentaire / Points à revoir</label>
 <textarea name="points_to_review" rows={2} defaultValue={existing?.points_to_review ?? ''} disabled={disabled} placeholder="Difficultés rencontrées, points à approfondir"></textarea></div>
 </div>
 </div>

 {!disabled && (
 <div className="flex justify-end gap-2">
 <button name="draft" value="1" className="btn btn-outline">Enregistrer en brouillon</button>
 <button className="btn btn-primary">
  {existing?.status === 'submitted' ? 'Mettre à jour la saisie (reste soumise)'
   : existing?.status === 'refused' ? 'Re-soumettre après correction'
   : 'Soumettre pour validation'}
 </button>
 </div>
 )}
 </form>

 {!disabled && (
 <form action={deleteMyEntry} className="mt-4 bg-red-50 border-l-4 border-red-500 p-3 rounded flex items-center justify-between gap-3">
 <input type="hidden" name="session_id" value={session.id} />
 <div className="text-xs text-red-800">
 <b>Supprimer cette saisie :</b> à utiliser si vous vous êtes trompé.
 {session.self_declared
   ? ' La séance entière sera supprimée (c\'est une déclaration hors planning).'
   : ' Seule votre saisie sera supprimée ; la séance planifiée restera au planning pour une nouvelle saisie.'}
 </div>
 <button className="btn btn-sm btn-danger">Supprimer</button>
 </form>
 )}

 {/* Demander à l'admin la suppression de la séance planifiée (quand ce n'est pas une séance auto-déclarée) */}
 {!session.self_declared && (
  <div className="mt-3 bg-amber-50 border-l-4 border-amber-500 p-3 rounded">
   {pendingDeletion?.status === 'pending' ? (
    <div className="flex items-start justify-between gap-3">
     <div className="text-xs text-amber-900">
      <div className="font-semibold">Demande de suppression en attente</div>
      <div className="mt-1">Motif envoyé : <i>{pendingDeletion.reason ?? '—'}</i></div>
      <div className="text-[10px] text-gray-600">Soumise le {fmtDate(pendingDeletion.created_at)}. L'admin vous notifiera.</div>
     </div>
     <form action={cancelDeletionRequest}>
      <input type="hidden" name="id" value={pendingDeletion.id} />
      <input type="hidden" name="return_to" value={returnTo} />
      <button className="btn btn-sm btn-outline">Annuler la demande</button>
     </form>
    </div>
   ) : (
    <>
     {pendingDeletion?.status === 'rejected' && (
      <div className="text-xs text-red-700 mb-2">
       <b>Demande précédente refusée :</b> {pendingDeletion.admin_comment ?? '—'}
      </div>
     )}
     <details>
      <summary className="cursor-pointer text-xs font-semibold text-amber-900">
       Demander à l'administrateur la suppression de cette séance planifiée (doublon, erreur…)
      </summary>
      <form action={requestDeletion} className="mt-2 space-y-2">
       <input type="hidden" name="target_type" value="session" />
       <input type="hidden" name="target_id" value={session.id} />
       <input type="hidden" name="return_to" value={returnTo} />
       <textarea name="reason" rows={2} required placeholder="Motif (ex : doublon avec la séance du …, erreur de planning)"
        className="w-full border rounded px-2 py-1 text-xs" />
       <button className="btn btn-sm btn-outline">Envoyer la demande à l'admin</button>
      </form>
     </details>
    </>
   )}
  </div>
 )}

 {/* Demande de suppression de la MISSION entière (si séance liée à une mission) */}
 {session.mission_id && (
  <div className="mt-3 bg-red-50 border-l-4 border-red-700 p-3 rounded">
   {pendingMissionDeletion?.status === 'pending' ? (
    <div className="flex items-start justify-between gap-3">
     <div className="text-xs text-red-900">
      <div className="font-semibold">Demande de suppression de la mission <i>{session.mission?.name}</i> en attente</div>
      <div className="mt-1">Motif : <i>{pendingMissionDeletion.reason ?? '—'}</i></div>
     </div>
     <form action={cancelDeletionRequest}>
      <input type="hidden" name="id" value={pendingMissionDeletion.id} />
      <input type="hidden" name="return_to" value={returnTo} />
      <button className="btn btn-sm btn-outline">Annuler la demande</button>
     </form>
    </div>
   ) : (
    <>
     {pendingMissionDeletion?.status === 'rejected' && (
      <div className="text-xs text-red-700 mb-2">
       <b>Demande précédente refusée :</b> {pendingMissionDeletion.admin_comment ?? '—'}
      </div>
     )}
     <details>
      <summary className="cursor-pointer text-xs font-semibold text-red-900">
       Demander la suppression de la mission entière « {session.mission?.name} » (toutes les séances seront supprimées)
      </summary>
      <form action={requestDeletion} className="mt-2 space-y-2">
       <input type="hidden" name="target_type" value="mission" />
       <input type="hidden" name="target_id" value={session.mission_id} />
       <input type="hidden" name="return_to" value={returnTo} />
       <textarea name="reason" rows={2} required placeholder="Motif détaillé (ex : mission doublon, créée par erreur)"
        className="w-full border rounded px-2 py-1 text-xs" />
       <button className="btn btn-sm btn-danger">Envoyer la demande à l'admin</button>
      </form>
     </details>
    </>
   )}
  </div>
 )}

 <div className="mt-5">
 {/* @ts-expect-error async server component */}
 <SessionDocuments sessionId={session.id} readOnly={disabled} hideUpload={false} />
 </div>
 </div>
 )
}
