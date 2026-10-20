import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { editEntryHours, unvalidateEntry, changeEntryCfa } from '@/actions/entries'
import { fmtDate, fmtHours } from '@/lib/utils'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminEntryDetailPage({ params }: { params: { id: string } }) {
 const s = createClient()
 const { data: entry } = await s.from('time_entries')
  .select(`id, status, work_date, hours_actual, actual_start, actual_end, break_minutes,
   adjustment_reason, content_covered, work_done, points_to_review, pedagogical_supports,
   program_completion, admin_comment, trainer_comment, validated_at,
   trainer:trainers(id, first_name, last_name, email),
   session:mission_sessions(id, session_date, start_time, end_time, room, self_declared, mission_id, cfa_id,
    mission:missions(id, name, cfa:cfa(id, name)),
    cfa:cfa(id, name))`)
  .eq('id', params.id).single()

 if (!entry) notFound()
 const e: any = entry
 const se: any = e.session
 const mission: any = se?.mission
 const cfa: any = mission?.cfa ?? se?.cfa
 const isHorsMission = !mission

 const { data: cfas } = await s.from('cfa').select('id, name').is('archived_at', null).order('name')
 const returnTo = `/entries/${params.id}`

 return (
  <div>
   <PageHeader
    title={`Saisie du ${fmtDate(e.work_date)} — ${e.trainer?.first_name} ${e.trainer?.last_name}`}
    subtitle={`${isHorsMission ? 'Séance hors planning' : mission.name} · ${cfa?.name ?? 'Sans CFA'} · ${fmtHours(Number(e.hours_actual ?? 0))} validées`}
    actions={<Link href="/dashboard" className="btn btn-outline">← Retour tableau de bord</Link>}
   />

   <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
    {/* Colonne gauche — infos */}
    <div className="lg:col-span-2 space-y-4">
     <div className="card">
      <div className="card-header"><div className="card-title">Infos séance</div></div>
      <div className="card-body text-sm grid grid-cols-2 gap-3">
       <div><div className="text-[11px] text-gray-500 uppercase">Date</div><div className="font-semibold">{fmtDate(e.work_date)}</div></div>
       <div><div className="text-[11px] text-gray-500 uppercase">Horaires</div><div className="font-semibold">{e.actual_start?.slice(0,5)} - {e.actual_end?.slice(0,5)}</div></div>
       <div><div className="text-[11px] text-gray-500 uppercase">Pause</div><div className="font-semibold">{e.break_minutes ?? 0} min</div></div>
       <div><div className="text-[11px] text-gray-500 uppercase">Heures nettes</div><div className="font-semibold text-navy">{fmtHours(Number(e.hours_actual ?? 0))}</div></div>
       <div><div className="text-[11px] text-gray-500 uppercase">CFA</div><div className="font-semibold">{cfa?.name ?? '—'}</div></div>
       <div><div className="text-[11px] text-gray-500 uppercase">Mission</div>
        <div className="font-semibold">
         {mission
          ? <Link href={`/missions/${mission.id}`} className="text-brand hover:underline">{mission.name}</Link>
          : <span className="italic text-amber-700">Hors mission (séance auto-déclarée)</span>}
        </div>
       </div>
       <div><div className="text-[11px] text-gray-500 uppercase">Salle</div><div>{se?.room ?? '—'}</div></div>
       <div><div className="text-[11px] text-gray-500 uppercase">Validée le</div><div>{e.validated_at ? fmtDate(e.validated_at) : '—'}</div></div>
      </div>
     </div>

     <div className="card">
      <div className="card-header"><div className="card-title">Contenu pédagogique saisi par le formateur</div></div>
      <div className="card-body text-sm space-y-3">
       <Field label="Contenu couvert" value={e.content_covered} />
       <Field label="Travail / exercices faits" value={e.work_done} />
       <Field label="Points à revoir" value={e.points_to_review} />
       <Field label="Supports pédagogiques" value={e.pedagogical_supports} />
       {e.program_completion != null && (
        <div>
         <div className="text-[11px] text-gray-500 uppercase font-semibold mb-1">Avancement programme</div>
         <div className="font-semibold">{e.program_completion} %</div>
        </div>
       )}
       {e.trainer_comment && <Field label="Commentaire formateur" value={e.trainer_comment} />}
       {e.admin_comment && <Field label="Commentaire admin" value={e.admin_comment} />}
       {e.adjustment_reason && <Field label="Motif d'ajustement" value={e.adjustment_reason} />}
      </div>
     </div>
    </div>

    {/* Colonne droite — actions */}
    <div className="space-y-4">
     <div className="card">
      <div className="card-header"><div className="card-title">Modifier les heures</div></div>
      <form action={editEntryHours} className="card-body space-y-2">
       <input type="hidden" name="entry_id" value={e.id} />
       <input type="hidden" name="return_to" value={returnTo} />
       <div className="flex gap-2">
        <div className="flex-1">
         <label className="text-[11px] font-semibold">Début</label>
         <input type="time" name="actual_start" defaultValue={e.actual_start?.slice(0,5)} className="w-full border rounded px-2 py-1 text-sm" />
        </div>
        <div className="flex-1">
         <label className="text-[11px] font-semibold">Fin</label>
         <input type="time" name="actual_end" defaultValue={e.actual_end?.slice(0,5)} className="w-full border rounded px-2 py-1 text-sm" />
        </div>
       </div>
       <div>
        <label className="text-[11px] font-semibold">Pause (min)</label>
        <input type="number" name="break_minutes" defaultValue={e.break_minutes ?? 60} className="w-full border rounded px-2 py-1 text-sm" />
       </div>
       <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" name="deduct_lunch" value="1" />
        Forcer 1h de pause déjeuner
       </label>
       <div>
        <label className="text-[11px] font-semibold">Motif d'ajustement</label>
        <input type="text" name="adjustment_reason" defaultValue={e.adjustment_reason ?? ''} className="w-full border rounded px-2 py-1 text-sm" />
       </div>
       <button className="btn btn-primary w-full">Enregistrer</button>
      </form>
     </div>

     <div className="card">
      <div className="card-header"><div className="card-title">Changer le CFA</div></div>
      <form action={changeEntryCfa} className="card-body space-y-2">
       <input type="hidden" name="entry_id" value={e.id} />
       <select name="cfa_id" defaultValue={cfa?.id ?? ''} className="w-full border rounded px-2 py-1 text-sm">
        <option value="">— Choisir —</option>
        {(cfas ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
       </select>
       <p className="text-[10px] text-gray-500">
        {mission
         ? 'Changement propagé à toutes les séances de la mission (futures factures CFA correctes).'
         : 'Change le CFA de cette séance uniquement.'}
       </p>
       <button className="btn btn-outline w-full">Appliquer</button>
      </form>
     </div>

     <div className="card border-l-4 border-l-amber-500">
      <div className="card-header"><div className="card-title">Dévalider la saisie</div></div>
      <form action={unvalidateEntry} className="card-body space-y-2">
       <input type="hidden" name="entry_id" value={e.id} />
       <input type="hidden" name="return_to" value={returnTo} />
       <p className="text-xs text-gray-600">La saisie retourne en file d'attente pour revalidation.</p>
       <button className="btn btn-outline w-full">↺ Dévalider</button>
      </form>
     </div>
    </div>
   </div>
  </div>
 )
}

function Field({ label, value }: { label: string; value?: string | null }) {
 return (
  <div>
   <div className="text-[11px] text-gray-500 uppercase font-semibold mb-1">{label}</div>
   <div className="whitespace-pre-wrap text-sm">{value ?? <span className="italic text-gray-400">— Non renseigné —</span>}</div>
  </div>
 )
}
