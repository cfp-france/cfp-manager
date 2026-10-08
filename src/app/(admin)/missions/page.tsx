import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function MissionsPage() {
  const s = createClient()
  const { data: missions } = await s.from('missions')
    .select('*, cfa(name), formations(code, name), mission_sessions(id, session_date, status)')
    .order('start_date', { ascending: false })

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
                <td>{m.cfa?.name}</td>
                <td>{m.formations?.code ?? '—'}</td>
                <td className="text-xs">{fmtDate(m.start_date)} → {fmtDate(m.end_date)}</td>
                <td>{m.mission_sessions?.length ?? 0}</td>
                <td className="text-xs">{m.cfa_hourly_rate}€ / {m.trainer_hourly_rate}€</td>
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
