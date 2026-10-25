import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtHours, requireTrainer } from '@/lib/utils'
import { downloadSessionDocAction } from '@/actions/session-documents'

export const dynamic = 'force-dynamic'

export default async function HistoriqueClassePage({ searchParams }: { searchParams: { cfa?: string; formation?: string; block?: string } }) {
 const { trainer } = await requireTrainer()
 if (!trainer) return <div className="card p-6 text-sm">Compte non lié à une fiche formateur.</div>

 const s = createClient()
 const [{ data: cfas }, { data: formations }, { data: blocks }] = await Promise.all([
  s.from('cfa').select('id, name').is('archived_at', null).order('name'),
  s.from('formations').select('id, code, name').is('archived_at', null).order('name'),
  s.from('competence_blocks').select('id, number, title, formation_id').order('number'),
 ])

 const cfaId = searchParams.cfa || ''
 const formationId = searchParams.formation || ''
 const blockId = searchParams.block || ''

 let entries: any[] = []
 if (formationId) {
  // On récupère les 2 dernières saisies validées pour cette formation (+ CFA optionnel)
  // via les mission_sessions dont la mission.formation_id matche.
  const { data: missionsMatching } = await s.from('missions')
   .select('id, cfa_id, formation_id, name, cfa:cfa(name)')
   .eq('formation_id', formationId)
   .is('archived_at', null)
  const missionsFiltered = (missionsMatching ?? []).filter((m: any) => !cfaId || m.cfa_id === cfaId)
  const missionIds = missionsFiltered.map((m: any) => m.id)

  if (missionIds.length > 0) {
   const { data: sessions } = await s.from('mission_sessions')
    .select('id, mission_id, session_date, start_time, end_time, room, trainer_id, cfa_id')
    .in('mission_id', missionIds)
    .lte('session_date', new Date().toISOString().slice(0, 10))
   const sessionIds = (sessions ?? []).map((x: any) => x.id)

   if (sessionIds.length > 0) {
    const { data: ents } = await s.from('time_entries')
     .select('id, session_id, work_date, actual_start, actual_end, hours_actual, content_covered, work_done, points_to_review, pedagogical_supports, competence_blocks_targeted, skill_ids, trainer_id')
     .in('session_id', sessionIds)
     .eq('status', 'validated')
     .order('work_date', { ascending: false })
     .limit(50)
    let filtered = ents ?? []
    // Filtre bloc / matière (optionnel)
    if (blockId) {
     const blockNumber = (blocks ?? []).find((b: any) => b.id === blockId)?.number
     filtered = filtered.filter((e: any) =>
      Array.isArray(e.competence_blocks_targeted) &&
      e.competence_blocks_targeted.includes(blockNumber)
     )
    }
    // Garder les 2 dernières
    const topTwo = filtered.slice(0, 2)
    if (topTwo.length > 0) {
     // Enrichir : trainer + session info + docs
     const trainerIds = Array.from(new Set(topTwo.map(e => e.trainer_id).filter(Boolean)))
     const sessIdsOfTop = topTwo.map(e => e.session_id)
     const [{ data: trainersInfo }, { data: docs }] = await Promise.all([
      trainerIds.length > 0
       ? s.from('trainers').select('id, first_name, last_name').in('id', trainerIds)
       : Promise.resolve({ data: [] }),
      s.from('session_documents').select('id, session_id, label, storage_path, mime_type, size_bytes, uploaded_at').in('session_id', sessIdsOfTop),
     ])
     const trainerById = new Map((trainersInfo ?? []).map((t: any) => [t.id, t]))
     const sessById = new Map((sessions ?? []).map((x: any) => [x.id, x]))
     const missionById = new Map(missionsFiltered.map((m: any) => [m.id, m]))
     const docsBySession: Record<string, any[]> = {}
     for (const d of (docs ?? []) as any[]) {
      if (!docsBySession[d.session_id]) docsBySession[d.session_id] = []
      docsBySession[d.session_id].push(d)
     }
     entries = topTwo.map((e: any) => ({
      ...e,
      trainer: trainerById.get(e.trainer_id) || null,
      session: sessById.get(e.session_id) || null,
      mission: missionById.get((sessById.get(e.session_id) as any)?.mission_id) || null,
      docs: docsBySession[e.session_id] || [],
     }))
    }
   }
  }
 }

 const formationsOfBlocksList = (formations ?? [])
 const blocksOfFormation = formationId ? (blocks ?? []).filter((b: any) => b.formation_id === formationId) : []

 return (
  <div>
   <PageHeader
    title="Historique classe"
    subtitle="Consultez les 2 dernières séances validées sur une formation — utile avant un remplacement."
   />

   <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded mb-5 text-sm text-blue-900">
    Choisissez le CFA (optionnel) et la formation que vous allez remplacer. Vous verrez les 2 dernières séances déjà effectuées, avec le contenu abordé par vos collègues et les supports pédagogiques téléchargeables.
   </div>

   <form method="GET" className="card p-3 mb-5 flex flex-wrap items-end gap-3 bg-brand-light/30">
    <div className="field mb-0 flex-1 min-w-[200px]">
     <label className="text-[11px] font-semibold text-navy">CFA (optionnel)</label>
     <select name="cfa" defaultValue={cfaId} className="text-sm border rounded px-2 py-1 w-full">
      <option value="">Tous les CFA</option>
      {(cfas ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
     </select>
    </div>
    <div className="field mb-0 flex-1 min-w-[220px]">
     <label className="text-[11px] font-semibold text-navy">Formation *</label>
     <select name="formation" required defaultValue={formationId} className="text-sm border rounded px-2 py-1 w-full">
      <option value="">— Choisir la formation —</option>
      {formationsOfBlocksList.map((f: any) => <option key={f.id} value={f.id}>{f.code} — {f.name}</option>)}
     </select>
    </div>
    <div className="field mb-0 flex-1 min-w-[200px]">
     <label className="text-[11px] font-semibold text-navy">Matière / bloc (optionnel)</label>
     <select name="block" defaultValue={blockId} className="text-sm border rounded px-2 py-1 w-full" disabled={!formationId}>
      <option value="">Toutes matières</option>
      {blocksOfFormation.map((b: any) => <option key={b.id} value={b.id}>B{b.number} — {b.title}</option>)}
     </select>
    </div>
    <button className="btn btn-sm btn-primary">Afficher</button>
   </form>

   {!formationId ? (
    <div className="card p-8 text-center text-gray-500">Sélectionnez une formation ci-dessus pour voir les 2 dernières séances.</div>
   ) : entries.length === 0 ? (
    <div className="card p-8 text-center text-gray-500">
     Aucune séance validée trouvée pour cette formation {cfaId ? '(pour ce CFA) ' : ''}pour le moment.
     <div className="text-xs mt-2 text-gray-400">Vérifiez le CFA ou la matière sélectionnés, ou revenez plus tard quand une séance aura été validée.</div>
    </div>
   ) : (
    <div className="space-y-4">
     {entries.map((e: any) => (
      <div key={e.id} className="card">
       <div className="card-header bg-brand-light">
        <div className="flex items-center justify-between flex-wrap gap-2">
         <div>
          <div className="card-title">Séance du {fmtDate(e.work_date)}</div>
          <div className="text-xs text-gray-600 mt-0.5">
           {e.actual_start?.slice(0,5)} - {e.actual_end?.slice(0,5)} · <b>{fmtHours(Number(e.hours_actual ?? 0))}</b>
           {e.trainer && <> · Formateur : <b>{e.trainer.first_name} {e.trainer.last_name}</b></>}
           {e.session?.room && <> · Salle {e.session.room}</>}
          </div>
          {e.mission && (
           <div className="text-[11px] text-gray-500">{e.mission.cfa?.name ?? ''} · {e.mission.name}</div>
          )}
         </div>
        </div>
       </div>
       <div className="card-body text-sm space-y-3">
        <Field label="Contenu abordé" value={e.content_covered} />
        <Field label="Travail effectué / avancement" value={e.work_done} />
        <Field label="Points à revoir" value={e.points_to_review} />
        <Field label="Supports pédagogiques (description)" value={e.pedagogical_supports} />
        {e.docs.length > 0 && (
         <div>
          <div className="text-[11px] text-gray-500 uppercase font-semibold mb-1">Fichiers de supports ({e.docs.length})</div>
          <ul className="space-y-1">
           {e.docs.map((d: any) => (
            <li key={d.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded p-2 text-xs">
             <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{d.label || 'Support'}</div>
              <div className="text-[10px] text-gray-500">
               {d.mime_type && d.mime_type.split('/')[1]?.toUpperCase()}
               {d.size_bytes && ` · ${(d.size_bytes / 1024).toFixed(0)} Ko`}
              </div>
             </div>
             <form action={downloadSessionDocAction}>
              <input type="hidden" name="path" value={d.storage_path} />
              <button className="btn btn-sm btn-outline">Télécharger</button>
             </form>
            </li>
           ))}
          </ul>
         </div>
        )}
       </div>
      </div>
     ))}
     <div className="text-center text-[11px] text-gray-500 italic">
      Consultation en lecture seule — vous ne pouvez pas modifier les saisies de vos collègues.
     </div>
    </div>
   )}
  </div>
 )
}

function Field({ label, value }: { label: string; value?: string | null }) {
 return (
  <div>
   <div className="text-[11px] text-gray-500 uppercase font-semibold mb-1">{label}</div>
   <div className="whitespace-pre-wrap">{value || <span className="italic text-gray-400">— Non renseigné —</span>}</div>
  </div>
 )
}
