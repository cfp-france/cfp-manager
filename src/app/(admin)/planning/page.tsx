import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtEuro, fmtHours } from '@/lib/utils'
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
function toMin(hhmm: string): number { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }

export default async function PlanningPage({ searchParams }: { searchParams: { w?: string; cfa?: string } }) {
  const s = createClient()
  const monday = parseWeekFrom(searchParams.w)
  const sunday = addDays(monday, 6)
  const prevWeek = iso(addDays(monday, -7))
  const nextWeek = iso(addDays(monday, 7))
  const cfaFilter = searchParams.cfa && searchParams.cfa !== '' ? searchParams.cfa : null

  const [{ data: cfas }, { data: sessions }, { data: templateSlots }, { data: absences }] = await Promise.all([
    s.from('cfa').select('id, name, city, default_hourly_rate').is('archived_at', null).order('name'),
    s.from('mission_sessions')
      .select('id, session_date, start_time, end_time, room, trainer_id, cfa_id, needs_substitution, break_minutes, mission:missions(name, cfa_hourly_rate, cfa:cfa(id, name, default_hourly_rate), formation:formations(code, name)), trainer:trainers(id, first_name, last_name, hourly_rate_default), cfa:cfa(id, name, default_hourly_rate)')
      .gte('session_date', iso(monday))
      .lte('session_date', iso(sunday))
      .order('session_date').order('start_time'),
    s.from('weekly_schedule_slots')
      .select('id, cfa_id, weekday, start_time, end_time, kind, room, label, trainer_id, trainer:trainers(id, first_name, last_name, hourly_rate_default), formation:formations(code, name), cfa:cfa(id, name, default_hourly_rate)')
      .in('kind', ['lesson', 'event']),
    s.from('trainer_absences').select('trainer_id, start_date, end_date, status').eq('status', 'validated').lte('start_date', iso(sunday)).gte('end_date', iso(monday)),
  ])

  const cfaFilterOk = (cfaId: string | null | undefined) => !cfaFilter || cfaId === cfaFilter

  const concreteByKey = new Set<string>()  // date|start_time pour éviter doublon avec template
  const items: any[] = []

  // 1. Séances concrètes
  for (const se of sessions ?? []) {
    const cfaId = (se as any).mission?.cfa?.id ?? (se as any).cfa?.id ?? null
    if (!cfaFilterOk(cfaId)) continue
    const key = `${(se as any).session_date}|${(se as any).start_time?.slice(0,5)}|${cfaId}`
    concreteByKey.add(key)
    items.push({
      kind: 'real',
      session_date: (se as any).session_date,
      start_time: (se as any).start_time,
      end_time: (se as any).end_time,
      break_minutes: (se as any).break_minutes ?? 0,
      room: (se as any).room,
      trainer_id: (se as any).trainer_id,
      trainer: (se as any).trainer,
      cfa: (se as any).mission?.cfa ?? (se as any).cfa ?? { id: cfaId, name: 'Sans CFA' },
      mission: (se as any).mission,
      formation: (se as any).mission?.formation,
      cfaRate: Number((se as any).mission?.cfa_hourly_rate) || Number((se as any).mission?.cfa?.default_hourly_rate) || Number((se as any).cfa?.default_hourly_rate) || 0,
    })
  }

  // 2. Créneaux récurrents du planning hebdo (projetés sur chaque jour de la semaine)
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const date = iso(addDays(monday, dayIdx))
    const pgWeekday = dayIdx + 1  // 1=lundi, 7=dimanche
    for (const sl of templateSlots ?? []) {
      if ((sl as any).weekday !== pgWeekday) continue
      const cfaId = (sl as any).cfa_id
      if (!cfaFilterOk(cfaId)) continue
      const key = `${date}|${(sl as any).start_time?.slice(0,5)}|${cfaId}`
      if (concreteByKey.has(key)) continue   // déjà une vraie séance → on ne duplique pas
      items.push({
        kind: 'template',
        session_date: date,
        start_time: (sl as any).start_time,
        end_time: (sl as any).end_time,
        break_minutes: 0,
        room: (sl as any).room,
        trainer_id: (sl as any).trainer_id,
        trainer: (sl as any).trainer,
        cfa: (sl as any).cfa ?? { id: cfaId, name: 'Sans CFA' },
        mission: null,
        formation: (sl as any).formation,
        cfaRate: Number((sl as any).cfa?.default_hourly_rate) || 0,
      })
    }
  }

  // Grouper par CFA puis par jour
  const byCfa: Record<string, { cfaName: string; days: Record<string, any[]> }> = {}
  for (const it of items) {
    const cfaId = it.cfa?.id ?? 'unknown'
    const cfaName = it.cfa?.name ?? 'Sans CFA'
    if (!byCfa[cfaId]) byCfa[cfaId] = { cfaName, days: {} }
    if (!byCfa[cfaId].days[it.session_date]) byCfa[cfaId].days[it.session_date] = []
    byCfa[cfaId].days[it.session_date].push(it)
  }
  for (const g of Object.values(byCfa)) {
    for (const key in g.days) g.days[key].sort((a, b) => a.start_time.localeCompare(b.start_time))
  }

  // Calcul CA prévisionnel + total heures
  let totalHours = 0, ca = 0, unassignedCount = 0
  for (const it of items) {
    const durationMin = toMin(it.end_time?.slice(0,5)) - toMin(it.start_time?.slice(0,5)) - (it.break_minutes ?? 0)
    const h = Math.max(0, durationMin / 60)
    totalHours += h
    ca += h * (it.cfaRate ?? 0)
    if (!it.trainer_id) unassignedCount++
  }

  return (
    <div>
      <PageHeader
        title="Planning de la semaine"
        subtitle={`Du ${fmtDate(iso(monday))} au ${fmtDate(iso(sunday))} — ${items.length} créneaux projetés`}
      />

      {/* Navigation semaine + filtres */}
      <form className="card p-3 mb-4 flex flex-wrap items-end gap-3 bg-brand-light/30">
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

      {/* KPI prévisionnels */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">Heures planifiées</div>
          <div className="text-2xl font-bold text-navy mt-1">{fmtHours(totalHours)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">CA prévisionnel (semaine)</div>
          <div className="text-2xl font-bold text-navy mt-1">{fmtEuro(ca)}</div>
          <div className="text-[10px] text-gray-500 mt-1">Basé sur les tarifs CFA renseignés sur les missions / fiches CFA.</div>
        </div>
        <div className={`card p-4 ${unassignedCount > 0 ? 'bg-red-50 border-red-500 border-l-4' : 'bg-green-50 border-green-500 border-l-4'}`}>
          <div className="text-[11px] text-gray-600 font-semibold uppercase tracking-wider">Séances à pourvoir</div>
          <div className={`text-2xl font-bold mt-1 ${unassignedCount > 0 ? 'text-red-700' : 'text-green-700'}`}>{unassignedCount}</div>
        </div>
      </div>

      {Object.keys(byCfa).length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          Aucun créneau ni séance planifiée cette semaine.
          <div className="text-xs mt-2 text-gray-400">Astuce : construisez votre planning hebdomadaire récurrent dans « Planning récurrent (grille) », il sera projeté ici automatiquement.</div>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.values(byCfa).map(group => (
            <div key={group.cfaName} className="card">
              <div className="card-header bg-brand-light">
                <div>
                  <div className="card-title">{group.cfaName}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {Object.values(group.days).reduce((s, d) => s + d.length, 0)} créneaux cette semaine
                  </div>
                </div>
              </div>
              <div className="card-body p-0">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th>Jour</th><th>Date</th><th>Horaires</th>
                      <th>Formation</th><th>Mission</th><th>Formateur</th><th>Tarif form.</th><th>Salle</th><th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 7 }).map((_, dayIdx) => {
                      const dayDate = iso(addDays(monday, dayIdx))
                      const daySessions = group.days[dayDate] ?? []
                      if (daySessions.length === 0) return null
                      return daySessions.map((it: any, i: number) => {
                        const noTrainer = !it.trainer_id
                        const isTemplate = it.kind === 'template'
                        const trainerRate = Number(it.trainer?.hourly_rate_default) || 0
                        return (
                          <tr
                            key={`${it.kind}-${dayDate}-${i}`}
                            className={noTrainer ? '' : (isTemplate ? 'bg-blue-50/40' : '')}
                            style={noTrainer ? { backgroundColor: '#1f2937', color: '#ffffff' } : undefined}
                          >
                            {i === 0 ? <td rowSpan={daySessions.length} className="font-semibold align-top bg-gray-50 text-gray-900">{WEEKDAYS[dayIdx]}</td> : null}
                            <td>{fmtDate(it.session_date)}</td>
                            <td>{it.start_time?.slice(0,5)} - {it.end_time?.slice(0,5)}</td>
                            <td>
                              <div className="font-semibold">{it.formation?.code ?? '—'}</div>
                              <div className={noTrainer ? 'text-white/70' : 'text-gray-500'}>{it.formation?.name ?? ''}</div>
                            </td>
                            <td className="max-w-[200px]"><div className="truncate">{it.mission?.name ?? (isTemplate ? '— (planning récurrent)' : '—')}</div></td>
                            <td className={noTrainer ? 'font-bold uppercase tracking-wider' : ''}>
                              {it.trainer ? `${it.trainer.first_name} ${it.trainer.last_name}` : 'À POURVOIR'}
                            </td>
                            <td className="font-semibold">
                              {it.trainer ? (trainerRate > 0 ? `${trainerRate} €/h` : '—') : '—'}
                            </td>
                            <td>{it.room ?? '—'}</td>
                            <td>
                              {isTemplate
                                ? <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 font-semibold">Récurrent</span>
                                : <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-800 font-semibold">Instancié</span>}
                            </td>
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
