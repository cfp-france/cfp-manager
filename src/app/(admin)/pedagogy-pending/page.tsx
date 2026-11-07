import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtHours } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function PedagogyPendingPage() {
 const s = createClient()

 const { data: entries } = await s.from('time_entries')
  .select(`id, session_id, work_date, actual_start, actual_end, hours_actual, status, created_at, validated_at,
           trainer:trainers(id, first_name, last_name, company_name),
           session:mission_sessions(id, session_date, start_time, end_time, room, cfa_id,
             mission:missions(id, name, cfa:cfa(id, name)),
             cfa:cfa(id, name))`)
  .eq('needs_trainer_pedagogy', true)
  .order('work_date', { ascending: true })

 const all = entries ?? []

 // Regrouper par formateur pour pouvoir relancer
 const byTrainer: Record<string, { trainer: any; entries: any[] }> = {}
 for (const e of all) {
  const tid = (e as any).trainer?.id ?? 'unknown'
  if (!byTrainer[tid]) byTrainer[tid] = { trainer: (e as any).trainer, entries: [] }
  byTrainer[tid].entries.push(e)
 }
 const groups = Object.values(byTrainer).sort((a, b) =>
  (a.trainer?.last_name ?? '').localeCompare(b.trainer?.last_name ?? ''))

 const nbTotal = all.length
 const nbValidated = all.filter((e: any) => e.status === 'validated').length
 const nbNotValidated = nbTotal - nbValidated

 return (
  <div>
   <PageHeader
    title="Déroulés pédagogiques à compléter"
    subtitle="Séances déclarées par l'administration — les formateurs doivent renseigner le contenu pédagogique"
   />

   <div className="grid grid-cols-3 gap-3 mb-5">
    <Kpi label="Total en attente" value={String(nbTotal)} />
    <Kpi label="Dont heures validées" value={String(nbValidated)} tone="green" />
    <Kpi label="Dont non validées" value={String(nbNotValidated)} tone="amber" />
   </div>

   {nbTotal === 0 ? (
    <div className="card p-6 text-center text-sm text-gray-500">
     ✓ Aucun déroulé pédagogique en attente. Tous les formateurs sont à jour.
    </div>
   ) : (
    <div className="space-y-4">
     {groups.map(g => (
      <div key={g.trainer?.id ?? 'unknown'} className="card">
       <div className="card-header">
        <div className="card-title flex items-center gap-2">
         {g.trainer?.company_name || `${g.trainer?.first_name ?? ''} ${g.trainer?.last_name ?? ''}`.trim()}
         <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-100 text-orange-800">
          {g.entries.length} déroulé(s) à compléter
         </span>
        </div>
       </div>
       <div className="card-body p-0">
        <table className="w-full">
         <thead>
          <tr>
           <th>Date séance</th>
           <th>Horaires</th>
           <th>Mission / CFA</th>
           <th>Heures</th>
           <th>Statut validation</th>
           <th>Déclarée le</th>
          </tr>
         </thead>
         <tbody>
          {g.entries.map((e: any) => (
           <tr key={e.id}>
            <td className="text-xs font-semibold">{fmtDate(e.work_date)}</td>
            <td className="text-xs font-mono">{(e.actual_start ?? '').slice(0,5)}–{(e.actual_end ?? '').slice(0,5)}</td>
            <td className="text-xs">
             <div className="font-semibold">{e.session?.mission?.name ?? <span className="italic text-gray-500">Hors mission</span>}</div>
             <div className="text-gray-500">{e.session?.mission?.cfa?.name ?? e.session?.cfa?.name ?? ''}</div>
            </td>
            <td className="text-xs">{fmtHours(Number(e.hours_actual ?? 0))}</td>
            <td>
             {e.status === 'validated' ? (
              <span className="inline-block px-2 py-1 rounded text-[11px] font-semibold bg-green-100 text-green-800">
               ✓ Heures validées
              </span>
             ) : (
              <span className="inline-block px-2 py-1 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
               ⏳ Non validées
              </span>
             )}
            </td>
            <td className="text-[11px] text-gray-500">{fmtDate(e.created_at)}</td>
           </tr>
          ))}
         </tbody>
        </table>
       </div>
      </div>
     ))}
    </div>
   )}

   <div className="mt-6 text-xs text-gray-500">
    💡 Dès qu'un formateur complète le déroulé pédagogique (contenu abordé + compétences visées) et enregistre,
    la séance disparaît automatiquement de cette liste. La validation des heures est conservée si vous les aviez déjà validées.
   </div>
  </div>
 )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'amber' }) {
 const bg = tone === 'green' ? 'bg-green-50' : tone === 'amber' ? 'bg-amber-50' : 'bg-gray-50'
 const txt = tone === 'green' ? 'text-green-800' : tone === 'amber' ? 'text-amber-800' : 'text-navy'
 return (
  <div className={`card p-3 ${bg}`}>
   <div className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">{label}</div>
   <div className={`text-xl font-bold ${txt} mt-0.5`}>{value}</div>
  </div>
 )
}
