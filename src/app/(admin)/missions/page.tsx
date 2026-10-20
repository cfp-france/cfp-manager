import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function MissionsPage() {
 const s = createClient()
 // Requête simple pour éviter les ambiguïtés de jointure
 const { data: missions, error } = await s.from('missions')
 .select('id, name, cfa_id, formation_id, start_date, end_date, cfa_hourly_rate, trainer_hourly_rate, archived_at')
 .order('start_date', { ascending: false })
 if (error) console.error('[missions list]', error)

 // Charger CFA et formations séparément
 const cfaIds = [...new Set((missions ?? []).map(m => m.cfa_id).filter(Boolean))]
 const formationIds = [...new Set((missions ?? []).map(m => m.formation_id).filter(Boolean))]
 const [{ data: cfas }, { data: formations }, { data: sessionCounts }] = await Promise.all([
 cfaIds.length ? s.from('cfa').select('id, name').in('id', cfaIds) : Promise.resolve({ data: [] }),
 formationIds.length ? s.from('formations').select('id, code, name').in('id', formationIds) : Promise.resolve({ data: [] }),
 s.from('mission_sessions').select('mission_id'),
 ])
 const cfaById = Object.fromEntries((cfas ?? []).map((c: any) => [c.id, c]))
 const formationById = Object.fromEntries((formations ?? []).map((f: any) => [f.id, f]))
 const sessionsCountByMission: Record<string, number> = {}
 for (const r of sessionCounts ?? []) {
 const mid = (r as any).mission_id
 if (mid) sessionsCountByMission[mid] = (sessionsCountByMission[mid] ?? 0) + 1
 }

 return (
 <div>
 <PageHeader title="Missions" subtitle={`${missions?.length ?? 0} missions`}
 actions={<Link href="/missions/new" className="btn btn-primary">+ Nouvelle mission</Link>} />

 <div className="card">
 <table className="w-full">
 <thead><tr>
 <th>Nom</th><th>CFA</th><th>Formation</th><th>Période</th>
 <th>Séances</th><th>Tarifs (CFA / Formateur)</th><th>Statut</th><th></th>
 </tr></thead>
 <tbody>
 {missions?.map((m: any) => (
 <tr key={m.id}>
 <td className="font-semibold">
 <Link href={`/missions/${m.id}`} className="text-brand hover:underline">{m.name}</Link>
 </td>
 <td>{cfaById[m.cfa_id]?.name ?? '—'}</td>
 <td>{m.formation_id ? (formationById[m.formation_id]?.code ?? '—') : '—'}</td>
 <td className="text-xs">{fmtDate(m.start_date)} → {fmtDate(m.end_date)}</td>
 <td>{sessionsCountByMission[m.id] ?? 0}</td>
 <td className="text-xs">
 {Number(m.cfa_hourly_rate ?? 0)}€ /{' '}
 {Number(m.trainer_hourly_rate) > 0
  ? `${Number(m.trainer_hourly_rate)}€`
  : <span className="italic text-amber-700" title="Tarif par défaut du formateur appliqué">défaut form.</span>}
 </td>
 <td>
 {m.archived_at
 ? <span className="status status-refused">Archivée</span>
 : <span className="status status-active">Active</span>}
 </td>
 <td><Link href={`/missions/${m.id}`} className="btn btn-sm btn-outline">Modifier</Link></td>
 </tr>
 ))}
 {(!missions || missions.length === 0) && (
 <tr><td colSpan={8} className="text-center text-gray-500 py-8">
 Aucune mission. <Link href="/missions/new" className="text-brand underline">Créer une mission</Link>
 </td></tr>
 )}
 </tbody>
 </table>
 </div>
 </div>
 )
}
