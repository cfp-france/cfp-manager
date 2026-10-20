import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { updateMission, archiveMission, unarchiveMission } from '@/actions/missions'
import { editEntryHours, unvalidateEntry } from '@/actions/entries'
import { fmtDate, fmtHours } from '@/lib/utils'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function EditMissionPage({ params }: { params: { id: string } }) {
 const s = createClient()

 const [{ data: mission }, { data: cfas }, { data: formations }] = await Promise.all([
 s.from('missions')
 .select('*, cfa:cfa(name), mission_sessions(id, time_entries(id, status))')
 .eq('id', params.id).single(),
 s.from('cfa').select('id, name, city').is('archived_at', null).order('name'),
 s.from('formations').select('id, code, name').is('archived_at', null).order('name'),
 ])
 if (!mission) notFound()

 // Saisies validées de la mission : on récupère via les séances de la mission
 const sessionIds = (mission.mission_sessions ?? []).map((se: any) => se.id)
 let validatedEntries: any[] = []
 if (sessionIds.length > 0) {
   const { data: ents } = await s.from('time_entries')
     .select('id, status, work_date, hours_actual, actual_start, actual_end, break_minutes, adjustment_reason, content_covered, work_done, points_to_review, program_completion, trainer:trainers(first_name, last_name), session_id')
     .in('session_id', sessionIds)
     .eq('status', 'validated')
     .order('work_date', { ascending: false })
   validatedEntries = ents ?? []
 }
 const totalValidatedHours = validatedEntries.reduce((acc: number, e: any) => acc + Number(e.hours_actual ?? 0), 0)
 const returnTo = `/missions/${params.id}`

 const nbSessions = mission.mission_sessions?.length ?? 0
 const nbValidated = (mission.mission_sessions ?? []).reduce((acc: number, se: any) =>
 acc + (se.time_entries?.some((te: any) => te.status === 'validated') ? 1 : 0), 0)

 return (
 <div>
 <PageHeader
 title={mission.name}
 subtitle={`${mission.cfa?.name} · ${fmtDate(mission.start_date)} → ${fmtDate(mission.end_date)} · ${nbSessions} séances (${nbValidated} validées)`}
 actions={<Link href="/missions" className="btn btn-outline">← Retour</Link>}
 />

 {mission.archived_at && (
 <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded mb-4 text-sm flex items-center justify-between">
 <span> Cette mission est archivée depuis le {fmtDate(mission.archived_at)}.</span>
 <form action={unarchiveMission}>
 <input type="hidden" name="id" value={mission.id} />
 <button className="btn btn-sm btn-outline">Désarchiver</button>
 </form>
 </div>
 )}

 <form action={updateMission} className="space-y-4">
 <input type="hidden" name="id" value={mission.id} />

 <div className="card">
 <div className="card-header"><div className="card-title">Informations principales</div></div>
 <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
 <div className="field md:col-span-2">
 <label>Nom de la mission *</label>
 <input name="name" required defaultValue={mission.name} />
 </div>
 <div className="field">
 <label>CFA (client) *</label>
 <select name="cfa_id" required defaultValue={mission.cfa_id} className="font-medium">
 {(cfas ?? []).map((c: any) => (
 <option key={c.id} value={c.id}>{c.name}{c.city ? ` (${c.city})` : ''}</option>
 ))}
 </select>
 <p className="text-[11px] text-gray-500 mt-1">
 Si le formateur a saisi un mauvais CFA, corrigez-le ici — n'oubliez pas de cocher la case ci-dessous pour appliquer aux séances.
 </p>
 </div>
 <div className="field">
 <label>Formation</label>
 <select name="formation_id" defaultValue={mission.formation_id ?? ''}>
 <option value="">— Aucune —</option>
 {(formations ?? []).map((f: any) => (
 <option key={f.id} value={f.id}>{f.name}</option>
 ))}
 </select>
 </div>
 <div className="field">
 <label>Date début *</label>
 <input name="start_date" type="date" required defaultValue={mission.start_date} />
 </div>
 <div className="field">
 <label>Date fin *</label>
 <input name="end_date" type="date" required defaultValue={mission.end_date} />
 </div>
 <div className="field">
 <label>Tarif CFA (€ HT / h) *</label>
 <input name="cfa_hourly_rate" type="number" step="0.01" required defaultValue={mission.cfa_hourly_rate} />
 </div>
 <div className="field">
 <label>Tarif formateur (€ HT / h) *</label>
 <input name="trainer_hourly_rate" type="number" step="0.01" required defaultValue={mission.trainer_hourly_rate} />
 </div>
 <div className="field md:col-span-2">
 <label>Salle par défaut</label>
 <input name="default_room" defaultValue={mission.default_room ?? ''} />
 </div>
 <div className="field md:col-span-2">
 <label>Description / notes</label>
 <textarea name="description" rows={2} defaultValue={mission.description ?? ''} />
 </div>
 </div>
 </div>

 <div className="card">
 <div className="card-header"><div className="card-title">Propagation du changement de CFA</div></div>
 <div className="card-body">
 <label className="flex items-start gap-2 cursor-pointer text-sm">
 <input type="checkbox" name="apply_to_sessions" value="1" defaultChecked className="mt-0.5" />
 <span>
 <b>Appliquer le CFA choisi à toutes les séances de la mission</b> (recommandé si vous le corrigez).
 Cela réassocie les {nbSessions} séances au bon CFA ; utile pour que la future facture CFA pointe au bon endroit.
 Les factures CFA déjà émises ne sont pas modifiées.
 </span>
 </label>
 </div>
 </div>

 <div className="flex justify-between items-center">
 {!mission.archived_at ? (
 <form action={archiveMission}>
 <input type="hidden" name="id" value={mission.id} />
 <button className="btn btn-danger">⏸ Archiver la mission</button>
 </form>
 ) : <span />}
 <div className="flex gap-2">
 <Link href="/missions" className="btn btn-outline">Annuler</Link>
 <button type="submit" className="btn btn-primary"> Enregistrer</button>
 </div>
 </div>
 </form>

 {/* Saisies validées sur cette mission */}
 <div className="card mt-6">
  <div className="card-header">
   <div>
    <div className="card-title">Saisies validées sur cette mission ({validatedEntries.length})</div>
    <div className="text-xs text-gray-500 mt-0.5">
     Total : <b>{fmtHours(totalValidatedHours)}</b> validées. Vous pouvez modifier les heures d'une saisie ou la dévalider.
    </div>
   </div>
  </div>
  <div className="card-body p-0 overflow-visible">
   {validatedEntries.length === 0 ? (
    <div className="text-center text-gray-500 py-6 text-sm">Aucune saisie validée pour l'instant sur cette mission.</div>
   ) : (
    <table className="w-full text-xs">
     <thead>
      <tr>
       <th>Date</th><th>Formateur</th><th>Horaires</th><th>Pause</th><th>Heures nettes</th>
       <th>Contenu couvert</th><th className="w-[260px]">Actions</th>
      </tr>
     </thead>
     <tbody>
      {validatedEntries.map((e: any) => (
       <tr key={e.id} className="align-top">
        <td>{fmtDate(e.work_date)}</td>
        <td>{e.trainer?.first_name} {e.trainer?.last_name}</td>
        <td>{e.actual_start?.slice(0,5)} - {e.actual_end?.slice(0,5)}</td>
        <td>{e.break_minutes ?? 0} min</td>
        <td className="font-semibold">{fmtHours(Number(e.hours_actual ?? 0))}</td>
        <td className="max-w-[260px]">
         <div className="whitespace-pre-wrap">{e.content_covered ?? <span className="text-gray-400 italic">—</span>}</div>
         {e.work_done && <div className="text-[10px] text-gray-600 mt-1"><b>Travail fait :</b> {e.work_done}</div>}
         {e.points_to_review && <div className="text-[10px] text-amber-700 mt-1"><b>À revoir :</b> {e.points_to_review}</div>}
         {e.program_completion != null && (
          <div className="text-[10px] text-gray-500 mt-1">Avancement programme : {e.program_completion}%</div>
         )}
        </td>
        <td>
         <details className="relative inline-block">
          <summary className="btn btn-sm btn-outline cursor-pointer list-none">Modifier les heures</summary>
          <form action={editEntryHours} className="absolute right-0 bg-white border rounded-md shadow-lg p-3 mt-1 z-10 space-y-1 w-[280px]">
           <input type="hidden" name="entry_id" value={e.id} />
           <input type="hidden" name="return_to" value={returnTo} />
           <div className="flex gap-1">
            <div className="flex-1">
             <label className="text-[10px] font-semibold">Début</label>
             <input type="time" name="actual_start" defaultValue={e.actual_start?.slice(0,5)} className="w-full border rounded px-1 py-0.5 text-xs" />
            </div>
            <div className="flex-1">
             <label className="text-[10px] font-semibold">Fin</label>
             <input type="time" name="actual_end" defaultValue={e.actual_end?.slice(0,5)} className="w-full border rounded px-1 py-0.5 text-xs" />
            </div>
           </div>
           <div>
            <label className="text-[10px] font-semibold">Pause (min)</label>
            <input type="number" name="break_minutes" defaultValue={e.break_minutes ?? 60} className="w-full border rounded px-1 py-0.5 text-xs" />
           </div>
           <label className="flex items-center gap-1 text-[10px]">
            <input type="checkbox" name="deduct_lunch" value="1" />
            Forcer 1h de pause déjeuner
           </label>
           <div>
            <label className="text-[10px] font-semibold">Motif d'ajustement</label>
            <input type="text" name="adjustment_reason" defaultValue={e.adjustment_reason ?? ''} className="w-full border rounded px-1 py-0.5 text-xs" />
           </div>
           <button className="btn btn-sm btn-primary w-full">Enregistrer</button>
          </form>
         </details>
         <form action={unvalidateEntry} className="inline-block ml-1">
          <input type="hidden" name="entry_id" value={e.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <button className="btn btn-sm btn-outline" title="Remettre en file de validation">↺ Dévalider</button>
         </form>
        </td>
       </tr>
      ))}
     </tbody>
    </table>
   )}
  </div>
 </div>
 </div>
 )
}
