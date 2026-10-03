import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtEuro, fmtHours } from '@/lib/utils'
import Link from 'next/link'
import { unvalidateEntry } from '@/actions/entries'

export const dynamic = 'force-dynamic'

const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']

function parseDate(v?: string): string | null {
  if (!v) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

export default async function Dashboard({ searchParams }: { searchParams: { from?: string; to?: string; cfa?: string; preset?: string } }) {
  const s = createClient()
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = today.getMonth()

  // Presets rapides
  const preset = searchParams.preset ?? 'month'
  let defaultFrom: string, defaultTo: string
  if (preset === 'year') {
    defaultFrom = `${yyyy}-01-01`; defaultTo = `${yyyy}-12-31`
  } else if (preset === 'last90') {
    const d = new Date(); d.setDate(d.getDate() - 90)
    defaultFrom = d.toISOString().slice(0,10); defaultTo = today.toISOString().slice(0,10)
  } else if (preset === 'all') {
    defaultFrom = '2020-01-01'; defaultTo = '2099-12-31'
  } else { // 'month' = mois en cours
    defaultFrom = new Date(yyyy, mm, 1).toISOString().slice(0,10)
    defaultTo = new Date(yyyy, mm + 1, 0).toISOString().slice(0,10)
  }
  const from = parseDate(searchParams.from) ?? defaultFrom
  const to = parseDate(searchParams.to) ?? defaultTo
  const cfaFilter = searchParams.cfa && searchParams.cfa !== '' ? searchParams.cfa : null

  // Liste des CFA pour le filtre
  const { data: cfas } = await s.from('cfa').select('id, name').is('archived_at', null).order('name')

  // Entrées validées sur la période
  let query = s.from('time_entries')
    .select(`id, hours_actual, status, work_date, validated_at, session_id, trainer_id,
      trainer:trainers(first_name, last_name),
      session:mission_sessions(mission_id, cfa_id,
        mission:missions(name, cfa_hourly_rate, trainer_hourly_rate, cfa:cfa(id, name)),
        cfa:cfa(id, name))`)
    .eq('status', 'validated')
    .gte('work_date', from)
    .lte('work_date', to)
    .order('work_date', { ascending: false })

  const { data: entriesRaw } = await query

  // Filtre CFA côté app (parce que cfa_id est sur mission OU sur session)
  const entries = (entriesRaw ?? []).filter((e: any) => {
    if (!cfaFilter) return true
    const cfaId = e.session?.mission?.cfa?.id ?? e.session?.cfa?.id
    return cfaId === cfaFilter
  })

  let totalHours = 0, ca = 0, cost = 0
  for (const e of entries) {
    const h = Number(e.hours_actual ?? 0)
    const m: any = e.session?.mission
    totalHours += h
    ca += h * Number(m?.cfa_hourly_rate ?? 0)
    cost += h * Number(m?.trainer_hourly_rate ?? 0)
  }
  const margin = ca - cost
  const marginRate = ca > 0 ? Math.round((margin / ca) * 100) : 0

  // Alertes (toujours globales, pas filtrées)
  const [{ count: pendingCount }, { count: absCount }, { count: subCount }] = await Promise.all([
    s.from('time_entries').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
    s.from('trainer_absences').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
    s.from('mission_sessions').select('*', { count: 'exact', head: true }).eq('needs_substitution', true),
  ])

  const periodLabel = preset === 'month'
    ? `${MONTHS_FR[mm]} ${yyyy}`
    : preset === 'year' ? `Année ${yyyy}`
    : preset === 'last90' ? `90 derniers jours`
    : preset === 'all' ? 'Tout l\'historique'
    : `${fmtDate(from)} → ${fmtDate(to)}`

  return (
    <div>
      <PageHeader title="Tableau de bord" subtitle={`${periodLabel} — ${entries.length} saisie(s) validée(s)`} />

      {/* Barre de filtres */}
      <form className="card p-3 mb-5 flex flex-wrap items-end gap-3 bg-brand-light/30">
        <div className="field mb-0">
          <label className="text-[11px] font-semibold text-navy">Période rapide</label>
          <select name="preset" defaultValue={preset} className="text-sm border rounded px-2 py-1">
            <option value="month">Mois en cours</option>
            <option value="last90">90 derniers jours</option>
            <option value="year">Année en cours</option>
            <option value="all">Tout l'historique</option>
            <option value="custom">Personnalisée (dates ci-dessous)</option>
          </select>
        </div>
        <div className="field mb-0">
          <label className="text-[11px] font-semibold text-navy">Du</label>
          <input type="date" name="from" defaultValue={from} className="text-sm border rounded px-2 py-1" />
        </div>
        <div className="field mb-0">
          <label className="text-[11px] font-semibold text-navy">Au</label>
          <input type="date" name="to" defaultValue={to} className="text-sm border rounded px-2 py-1" />
        </div>
        <div className="field mb-0 flex-1 min-w-[200px]">
          <label className="text-[11px] font-semibold text-navy">CFA</label>
          <select name="cfa" defaultValue={cfaFilter ?? ''} className="text-sm border rounded px-2 py-1 w-full">
            <option value="">Tous les CFA</option>
            {(cfas ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button className="btn btn-sm btn-primary">Appliquer</button>
        <Link href="/dashboard" className="btn btn-sm btn-outline">Réinitialiser</Link>
      </form>

      {((pendingCount ?? 0) > 0 || (absCount ?? 0) > 0 || (subCount ?? 0) > 0) && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-md mb-5 text-sm flex flex-wrap gap-3 items-center">
          <span>⚠️</span>
          {(pendingCount ?? 0) > 0 && <Link className="font-semibold text-amber-800 hover:underline" href="/validation">{pendingCount} saisies à valider →</Link>}
          {(absCount ?? 0) > 0 && <Link className="font-semibold text-amber-800 hover:underline" href="/absences">{absCount} absences à traiter →</Link>}
          {(subCount ?? 0) > 0 && <Link className="font-semibold text-amber-800 hover:underline" href="/substitutions">{subCount} remplacements à pourvoir →</Link>}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label="Heures validées" value={fmtHours(totalHours)} />
        <Kpi label="CA généré" value={fmtEuro(ca)} />
        <Kpi label="Coût formateurs" value={fmtEuro(cost)} />
        <Kpi label="Marge brute" value={fmtEuro(margin)} sub={`Taux ${marginRate} %`} />
      </div>

      {/* Détail des saisies validées sur la période (avec bouton Dévalider) */}
      <div className="card mb-5">
        <div className="card-header">
          <div className="card-title">Saisies validées sur la période</div>
        </div>
        <div className="card-body p-0">
          <table className="w-full">
            <thead><tr><th>Date</th><th>Formateur</th><th>Mission / CFA</th><th>Heures</th><th></th></tr></thead>
            <tbody>
              {entries.slice(0, 50).map((e: any) => {
                const cfaName = e.session?.mission?.cfa?.name ?? e.session?.cfa?.name ?? '—'
                return (
                  <tr key={e.id}>
                    <td className="text-xs">{fmtDate(e.work_date)}</td>
                    <td className="text-xs">{e.trainer?.first_name} {e.trainer?.last_name}</td>
                    <td className="text-xs">
                      <div>{e.session?.mission?.name ?? <span className="italic text-gray-400">Hors mission</span>}</div>
                      <div className="text-gray-500">{cfaName}</div>
                    </td>
                    <td>{fmtHours(Number(e.hours_actual ?? 0))}</td>
                    <td>
                      <form action={unvalidateEntry}>
                        <input type="hidden" name="entry_id" value={e.id} />
                        <button className="btn btn-sm btn-outline" title="Remettre cette saisie en attente de validation">↺ Dévalider</button>
                      </form>
                    </td>
                  </tr>
                )
              })}
              {entries.length === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-500 py-6 text-sm">Aucune saisie validée sur cette période.</td></tr>
              )}
              {entries.length > 50 && (
                <tr><td colSpan={5} className="text-center text-xs text-gray-500 py-2">+ {entries.length - 50} autres saisies non affichées (affiner la période ou le CFA)</td></tr>
              )}
            </tbody>
          </table>
        </div>
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
