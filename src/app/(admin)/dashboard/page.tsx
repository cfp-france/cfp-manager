import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtEuro, fmtHours } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const s = createClient()
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  const { data: entries } = await s.from('time_entries')
    .select('hours_actual, status, work_date, session_id, mission_sessions(mission_id, missions(cfa_hourly_rate, trainer_hourly_rate))')
    .eq('status', 'validated').gte('work_date', monthStart)

  let totalHours = 0, ca = 0, cost = 0
  for (const e of entries ?? []) {
    const h = Number(e.hours_actual ?? 0)
    const m: any = (e as any).mission_sessions?.missions
    totalHours += h
    ca += h * Number(m?.cfa_hourly_rate ?? 0)
    cost += h * Number(m?.trainer_hourly_rate ?? 0)
  }
  const margin = ca - cost
  const marginRate = ca > 0 ? Math.round((margin / ca) * 100) : 0

  const [{ count: pendingCount }, { count: absCount }, { count: subCount }] = await Promise.all([
    s.from('time_entries').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
    s.from('trainer_absences').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
    s.from('mission_sessions').select('*', { count: 'exact', head: true }).eq('needs_substitution', true),
  ])

  return (
    <div>
      <PageHeader title="Tableau de bord" subtitle={`Mai ${new Date().getFullYear()} — activité en temps réel`} />

      {((pendingCount ?? 0) > 0 || (absCount ?? 0) > 0 || (subCount ?? 0) > 0) && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-md mb-5 text-sm flex flex-wrap gap-3 items-center">
          <span>⚠️</span>
          {(pendingCount ?? 0) > 0 && <Link className="font-semibold text-amber-800 hover:underline" href="/validation">{pendingCount} saisies à valider →</Link>}
          {(absCount ?? 0) > 0 && <Link className="font-semibold text-amber-800 hover:underline" href="/absences">{absCount} absences à traiter →</Link>}
          {(subCount ?? 0) > 0 && <Link className="font-semibold text-amber-800 hover:underline" href="/substitutions">{subCount} remplacements à pourvoir →</Link>}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label="Heures validées (mois)" value={fmtHours(totalHours)} />
        <Kpi label="CA généré (mois)" value={fmtEuro(ca)} />
        <Kpi label="Coût formateurs" value={fmtEuro(cost)} />
        <Kpi label="Marge brute" value={fmtEuro(margin)} sub={`Taux ${marginRate} %`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickLink href="/missions/new" title="+ Créer une mission" desc="Assistant avec planning récurrent" />
        <QuickLink href="/validation" title="✅ Valider des heures" desc="File des saisies en attente" />
        <QuickLink href="/pedagogy" title="🎓 Suivi pédagogique" desc="Export au format CFP" />
      </div>
    </div>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold text-navy tracking-tight mt-1">{value}</div>
      {sub && <div className="text-xs text-green-600 font-semibold mt-1">{sub}</div>}
    </div>
  )
}

function QuickLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="card p-4 hover:border-brand hover:shadow-md transition">
      <div className="text-navy font-semibold">{title}</div>
      <div className="text-xs text-gray-500 mt-1">{desc}</div>
    </Link>
  )
}
