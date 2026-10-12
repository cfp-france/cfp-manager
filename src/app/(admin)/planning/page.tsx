import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const WEEKDAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']

function parseWeekFrom(w?: string): Date {
  const now = new Date()
  const base = w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? new Date(w) : now
  const dow = (base.getDay() + 6) % 7
  const monday = new Date(base); monday.setDate(base.getDate() - dow)
  monday.setHours(0, 0, 0, 0)
  return monday
}
function iso(d: Date) { return d.toISOString().slice(0, 10) }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(d.getDate() + n); return r }

export default async function PlanningPage({ searchParams }: { searchParams: { w?: string; cfa?: string } }) {
  const s = createClient()
  const monday = parseWeekFrom(searchParams.w)
  const sunday = addDays(monday, 6)
  const prevWeek = iso(addDays(monday, -7))
  const nextWeek = iso(addDays(monday, 7))
  const cfaFilter = searchParams.cfa && searchParams.cfa !== '' ? searchParams.cfa : null

  const [{ data: cfas }, { data: sessions }, { data: trainers }, { data: absences }] = await Promise.all([
    s.from('cfa').select('id, name, city').is('archived_at', null).order('name'),
    s.from('mission_sessions')
      .select('id, session_date, start_time, end_time, room, trainer_id, cfa_id, needs_substitution, mission:missions(name, cfa:cfa(id, name), formation:formations(code, name)), trainer:trainers(first_name, last_name), cfa:cfa(id, name)')
      .gte('session_date', iso(monday))
      .lte('session_date', iso(sunday))
      .order('session_date').order('start_time'),
    s.from('trainers').select('id, first_name, last_name, active').eq('active', true).order('last_name'),
    s.from('trainer_absences').select('trainer_id, start_date, end_date, status').eq('status', 'validated').lte('start_date', iso(sunday)).gte('end_date', iso(monday)),
  ])

  const filteredSessions = (sessions ?? []).filter((se: any) => {
    if (!cfaFilter) return true
    const cfaId = se.mission?.cfa?.id ?? se.cfa?.id
    return cfaId === cfaFilter
  })

  // Grouper par CFA puis par jour
  const byCfa: Record<string, { cfaName: string; days: Record<string, any[]> }> = {}
  for (const se of filteredSessions) {
    const cfaId = (se as any).mission?.cfa?.id ?? (se as any).cfa?.id ?? 'unknown'
    const cfaName = (se as any).mission?.cfa?.name ?? (se as any).cfa?.name ?? 'Sans CFA'
    if (!byCfa[cfaId]) byCfa[cfaId] = { cfaName, days: {} }
    const dayKey = (se as any).session_date
    if (!byCfa[cfaId].days[dayKey]) byCfa[cfaId].days[dayKey] = []
    byCfa[cfaId].days[dayKey].push(se)
  }

  // Nombre de séances à pourvoir (sans formateur) sur la semaine
  const unassignedCount = filteredSessions.filter((se: any) => !se.trainer_id).length

  return (
    <div>
      <PageHeader
        title="Planning de la semaine"
        subtitle={`Du ${fmtDate(iso(monday))} au ${fmtDate(iso(sunday))}`}
      />

      {/* Navigation semaine + filtres */}
      <form className="card p-3 mb-5 flex flex-wrap items-end gap-3 bg-brand-light/30">
        <div className="flex gap-2">
          <Link href={`/planning?w=${prevWeek}${cfaFilter ? `&cfa=${cfaFilter}` : ''}`} className="btn btn-sm btn-outline">← Semaine précédente</Link>
          <Link href="/planning" className="btn btn-sm btn-outline">Cette semaine</Link>
          <Link href={`/planning?w=${nextWeek}${cfaFilter ? `&cfa=${cfaFilter}` : ''}`} className="btn btn-sm btn-outline">Semaine suivante →</Link>
        </div>
        <div className="field mb-0 flex-1 min-w-[200px]">
          <label className="text-[11px] font-semibold text-navy">Filtrer par CFA</label>
          <select name="cfa" defaultValue={cfaFilter ?? ''} className="text-sm border rounded px-2 py-1 w-full">
            <option value="">Tous les CFA</option>
            {(cfas ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <input type="hidden" name="w" value={iso(monday)} />
        <button className="btn btn-sm btn-primary">Appliquer</button>
      </form>

      {unassignedCount > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded mb-4 text-sm">
          <b>{unassignedCount} séance(s) sans formateur affecté</b> cette semaine (affichées en rouge ci-dessous).
          Pensez à les attribuer via la page de la mission concernée.
        </div>
      )}

      {Object.keys(byCfa).length === 0 ? (
        <div className="card p-8 text-center text-gray-500">Aucune séance planifiée cette semaine.</div>
      ) : (
        <div className="space-y-5">
          {Object.values(byCfa).map(group => (
            <div key={group.cfaName} className="card">
              <div className="card-header bg-brand-light">
                <div>
                  <div className="card-title">{group.cfaName}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {Object.values(group.days).reduce((s, d) => s + d.length, 0)} séance(s) cette semaine
                  </div>
                </div>
              </div>
              <div className="card-body p-0">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th>Jour</th><th>Date</th><th>Horaires</th>
                      <th>Formation</th><th>Mission</th><th>Formateur</th><th>Salle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 7 }).map((_, dayIdx) => {
                      const dayDate = iso(addDays(monday, dayIdx))
                      const daySessions = group.days[dayDate] ?? []
                      if (daySessions.length === 0) return null
                      return daySessions.map((se: any, i: number) => {
                        const noTrainer = !se.trainer_id
                        return (
                          <tr key={se.id} className={noTrainer ? 'bg-red-50' : ''}>
                            {i === 0 ? <td rowSpan={daySessions.length} className="font-semibold align-top bg-gray-50">{WEEKDAYS[dayIdx]}</td> : null}
                            <td className={i === 0 ? '' : ''}>{fmtDate(se.session_date)}</td>
                            <td>{se.start_time?.slice(0,5)} - {se.end_time?.slice(0,5)}</td>
                            <td>
                              <div className="font-semibold">{se.mission?.formation?.code ?? '—'}</div>
                              <div className="text-gray-500">{se.mission?.formation?.name ?? ''}</div>
                            </td>
                            <td className="max-w-[200px]"><div className="truncate">{se.mission?.name ?? '—'}</div></td>
                            <td className={noTrainer ? 'text-red-700 font-semibold' : ''}>
                              {se.trainer ? `${se.trainer.first_name} ${se.trainer.last_name}` : 'À pourvoir'}
                            </td>
                            <td>{se.room ?? '—'}</td>
                          </tr>
                        )
                      })
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
