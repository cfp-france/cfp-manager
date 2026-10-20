import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { approveDeletion, rejectDeletion } from '@/actions/deletion-requests'
import { fmtDate } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function DeletionRequestsPage({ searchParams }: { searchParams: { status?: string } }) {
 const s = createClient()
 const status = searchParams.status ?? 'pending'

 const { data: requests } = await s.from('deletion_requests')
  .select('id, target_type, target_id, reason, status, admin_comment, created_at, decided_at, trainer:trainers(first_name, last_name)')
  .eq('status', status)
  .order('created_at', { ascending: false })

 // Enrichir : pour chaque demande, aller chercher le titre de la cible
 const sessionIds = (requests ?? []).filter((r: any) => r.target_type === 'session').map((r: any) => r.target_id)
 const missionIds = (requests ?? []).filter((r: any) => r.target_type === 'mission').map((r: any) => r.target_id)

 const [{ data: sessionsInfo }, { data: missionsInfo }] = await Promise.all([
  sessionIds.length > 0
   ? s.from('mission_sessions').select('id, session_date, start_time, end_time, room, mission:missions(name, cfa:cfa(name)), cfa:cfa(name)').in('id', sessionIds)
   : Promise.resolve({ data: [] }),
  missionIds.length > 0
   ? s.from('missions').select('id, name, start_date, end_date, cfa:cfa(name)').in('id', missionIds)
   : Promise.resolve({ data: [] }),
 ])
 const sessionById = new Map((sessionsInfo ?? []).map((x: any) => [x.id, x]))
 const missionById = new Map((missionsInfo ?? []).map((x: any) => [x.id, x]))

 return (
  <div>
   <PageHeader
    title="Demandes de suppression"
    subtitle="Soumises par les formateurs. Validez pour supprimer définitivement, refusez pour conserver."
   />

   <div className="flex gap-2 mb-4">
    <Link href="/deletion-requests?status=pending" className={`btn btn-sm ${status === 'pending' ? 'btn-primary' : 'btn-outline'}`}>En attente</Link>
    <Link href="/deletion-requests?status=approved" className={`btn btn-sm ${status === 'approved' ? 'btn-primary' : 'btn-outline'}`}>Approuvées</Link>
    <Link href="/deletion-requests?status=rejected" className={`btn btn-sm ${status === 'rejected' ? 'btn-primary' : 'btn-outline'}`}>Refusées</Link>
   </div>

   {(!requests || requests.length === 0) ? (
    <div className="card p-8 text-center text-gray-500">Aucune demande dans cet état.</div>
   ) : (
    <div className="space-y-3">
     {requests.map((r: any) => {
      const se: any = sessionById.get(r.target_id)
      const mi: any = missionById.get(r.target_id)
      const title = r.target_type === 'session'
       ? (se ? `Séance du ${fmtDate(se.session_date)} ${se.start_time?.slice(0,5)}-${se.end_time?.slice(0,5)}` : 'Séance introuvable (déjà supprimée ?)')
       : (mi ? `Mission : ${mi.name}` : 'Mission introuvable (déjà supprimée ?)')
      const sub = r.target_type === 'session'
       ? (se ? `${se.mission?.name ?? 'Hors mission'} · ${se.mission?.cfa?.name ?? se.cfa?.name ?? '—'} · salle ${se.room ?? '—'}` : '')
       : (mi ? `${mi.cfa?.name ?? '—'} · du ${fmtDate(mi.start_date)} au ${fmtDate(mi.end_date)}` : '')

      return (
       <div key={r.id} className={`card ${r.status === 'pending' ? 'border-l-4 border-l-amber-500' : ''}`}>
        <div className="card-body grid grid-cols-1 md:grid-cols-3 gap-3">
         <div className="md:col-span-2">
          <div className="text-[11px] text-gray-500 uppercase font-semibold tracking-wider mb-1">
           {r.target_type === 'session' ? 'Suppression de séance' : 'Suppression de mission'}
          </div>
          <div className="font-semibold text-navy">{title}</div>
          <div className="text-xs text-gray-600 mt-0.5">{sub}</div>
          <div className="text-xs mt-2">
           Demandé par <b>{r.trainer?.first_name} {r.trainer?.last_name}</b> le {fmtDate(r.created_at)}
          </div>
          {r.reason && (
           <div className="mt-2 bg-gray-50 border-l-2 border-gray-300 p-2 text-xs">
            <div className="font-semibold text-gray-700 mb-0.5">Motif du formateur :</div>
            <div className="whitespace-pre-wrap">{r.reason}</div>
           </div>
          )}
          {r.admin_comment && (
           <div className="mt-2 bg-red-50 border-l-2 border-red-400 p-2 text-xs">
            <div className="font-semibold text-red-700 mb-0.5">Réponse admin :</div>
            <div className="whitespace-pre-wrap">{r.admin_comment}</div>
           </div>
          )}
         </div>
         {r.status === 'pending' && (
          <div className="space-y-2">
           <form action={approveDeletion}>
            <input type="hidden" name="id" value={r.id} />
            <button className="btn btn-danger w-full">✓ Approuver et supprimer</button>
           </form>
           <details>
            <summary className="btn btn-outline w-full cursor-pointer text-center">Refuser</summary>
            <form action={rejectDeletion} className="mt-2 space-y-1">
             <input type="hidden" name="id" value={r.id} />
             <textarea name="admin_comment" placeholder="Motif du refus (visible par le formateur)" rows={2} required className="w-full border rounded px-2 py-1 text-xs" />
             <button className="btn btn-outline w-full btn-sm">Confirmer le refus</button>
            </form>
           </details>
          </div>
         )}
         {r.status !== 'pending' && (
          <div className="text-xs text-gray-500 text-right">
           {r.status === 'approved' ? '✓ Approuvée' : '✗ Refusée'}<br />
           le {r.decided_at ? fmtDate(r.decided_at) : '—'}
          </div>
         )}
        </div>
       </div>
      )
     })}
    </div>
   )}
  </div>
 )
}
