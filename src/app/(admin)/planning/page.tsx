import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtEuro, fmtHours } from '@/lib/utils'
import { buildTrainerColorMap, NO_TRAINER_COLOR } from '@/lib/trainer-colors'
import { assignSubstitute, clearSessionTrainer } from '@/actions/substitutions'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const DAYS = [
  { num: 0, label: 'Lundi' },
  { num: 1, label: 'Mardi' },
  { num: 2, label: 'Mercredi' },
  { num: 3, label: 'Jeudi' },
  { num: 4, label: 'Vendredi' },
  { num: 5, label: 'Samedi' },
  { num: 6, label: 'Dimanche' },
]

const PX_PER_MIN = 1.1

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

/**
 * Attribue à chaque item une colonne et un nombre total de colonnes pour que
 * les créneaux qui se chevauchent (plusieurs formateurs sur la même plage)
 * s'affichent côte à côte.
 */
function layoutItemsForDay(items: any[]): { item: any; column: number; maxCols: number }[] {
  if (items.length === 0) return []
  const sorted = [...items].sort((a, b) => a.start_time.localeCompare(b.start_time) || a.end_time.localeCompare(b.end_time))
  type Active = { end: number; col: number }
  const active: Active[] = []
  const assigned: { item: any; column: number; maxCols: number }[] = []
  for (const sl of sorted) {
    const st = toMin(sl.start_time), en = toMin(sl.end_time)
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].end <= st) active.splice(i, 1)
    }
    const used = new Set(active.map(a => a.col))
    let col = 0
    while (used.has(col)) col++
    active.push({ end: en, col })
    assigned.push({ item: sl, column: col, maxCols: 1 })
  }
  for (const a of assigned) {
    const st = toMin(a.item.start_time), en = toMin(a.item.end_time)
    let maxCol = 0
    for (const b of assigned) {
      const bst = toMin(b.item.start_time), ben = toMin(b.item.end_time)
      if (bst < en && ben > st) maxCol = Math.max(maxCol, b.column + 1)
    }
    a.maxCols = maxCol
  }
  return assigned
}

export default async function PlanningPage({ searchParams }: { searchParams: { w?: string; cfa?: string } }) {
  const s = createClient()
  const monday = parseWeekFrom(searchParams.w)
  const sunday = addDays(monday, 6)
  const prevWeek = iso(addDays(monday, -7))
  const nextWeek = iso(addDays(monday, 7))
  const cfaFilter = searchParams.cfa && searchParams.cfa !== '' ? searchParams.cfa : null

  const [{ data: cfas }, { data: sessions }, { data: templateSlots }, { data: trainers }] = await Promise.all([
    s.from('cfa').select('id, name, city, default_hourly_rate').is('archived_at', null).order('name'),
    s.from('mission_sessions')
      .select('id, session_date, start_time, end_time, room, trainer_id, cfa_id, needs_substitution, break_minutes, mission:missions(name, cfa_hourly_rate, cfa:cfa(id, name, default_hourly_rate), formation:formations(code, name)), trainer:trainers(id, first_name, last_name, hourly_rate_default), cfa:cfa(id, name, default_hourly_rate)')
      .gte('session_date', iso(monday))
      .lte('session_date', iso(sunday))
      .order('session_date').order('start_time'),
    s.from('weekly_schedule_slots')
      .select('id, cfa_id, weekday, start_time, end_time, kind, room, label, trainer_id, trainer:trainers(id, first_name, last_name, hourly_rate_default), formation:formations(code, name), cfa:cfa(id, name, default_hourly_rate)')
      .in('kind', ['lesson', 'event']),
    s.from('trainers').select('id, first_name, last_name').eq('active', true).order('last_name'),
  ])

  const cfaFilterOk = (cfaId: string | null | undefined) => !cfaFilter || cfaId === cfaFilter

  const concreteByKey = new Set<string>()
  const items: any[] = []

  for (const se of sessions ?? []) {
    const cfaId = (se as any).mission?.cfa?.id ?? (se as any).cfa?.id ?? null
    if (!cfaFilterOk(cfaId)) continue
    const key = `${(se as any).session_date}|${(se as any).start_time?.slice(0,5)}|${cfaId}`
    concreteByKey.add(key)
    items.push({
      kind: 'real',
      session_id: (se as any).id,
      session_date: (se as any).session_date,
      start_time: (se as any).start_time?.slice(0,5),
      end_time: (se as any).end_time?.slice(0,5),
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

  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const date = iso(addDays(monday, dayIdx))
    const pgWeekday = dayIdx + 1
    for (const sl of templateSlots ?? []) {
      if ((sl as any).weekday !== pgWeekday) continue
      const cfaId = (sl as any).cfa_id
      if (!cfaFilterOk(cfaId)) continue
      const key = `${date}|${(sl as any).start_time?.slice(0,5)}|${cfaId}`
      if (concreteByKey.has(key)) continue
      items.push({
        kind: 'template',
        session_date: date,
        start_time: (sl as any).start_time?.slice(0,5),
        end_time: (sl as any).end_time?.slice(0,5),
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

  // Grouper par CFA
  const byCfa: Record<string, { cfaName: string; items: any[] }> = {}
  for (const it of items) {
    const cfaId = it.cfa?.id ?? 'unknown'
    const cfaName = it.cfa?.name ?? 'Sans CFA'
    if (!byCfa[cfaId]) byCfa[cfaId] = { cfaName, items: [] }
    byCfa[cfaId].items.push(it)
  }

  // Codes couleur formateurs
  const colorByTrainer = buildTrainerColorMap((trainers ?? []).map((t: any) => t.id))

  // KPIs
  let totalHours = 0, ca = 0, unassignedCount = 0
  for (const it of items) {
    const durationMin = toMin(it.end_time) - toMin(it.start_time) - (it.break_minutes ?? 0)
    const h = Math.max(0, durationMin / 60)
    totalHours += h
    ca += h * (it.cfaRate ?? 0)
    if (!it.trainer_id) unassignedCount++
  }

  const dayStart = toMin('08:00')
  const dayEnd = toMin('20:00')
  const totalMin = dayEnd - dayStart

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

      {/* Légende formateurs */}
      <div className="card p-3 mb-4">
        <div className="text-xs font-semibold text-navy uppercase tracking-wider mb-2">Formateurs — codes couleur</div>
        <div className="flex flex-wrap gap-2">
          {(trainers ?? []).map((t: any) => {
            const c = colorByTrainer[t.id] ?? NO_TRAINER_COLOR
            return (
              <span key={t.id} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                <span className="w-2 h-2 rounded-full" style={{ background: c.border }} />
                {t.first_name} {t.last_name}
              </span>
            )
          })}
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-white" style={{ background: '#1f2937', border: '1px solid #000' }}>
            À POURVOIR (sans formateur)
          </span>
        </div>
      </div>

      {Object.keys(byCfa).length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          Aucun créneau ni séance planifiée cette semaine.
          <div className="text-xs mt-2 text-gray-400">Astuce : construisez votre planning hebdomadaire récurrent dans « Planning récurrent (grille) », il sera projeté ici automatiquement.</div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-2 rounded text-[11px] text-blue-900">
            💡 <b>Cliquez sur une séance</b> pour programmer un remplacement de formateur ou déprogrammer le formateur actuel (créneau à pourvoir).
          </div>
          {Object.entries(byCfa).map(([cfaId, group]) => (
            <div key={cfaId}>
              <h2 className="text-lg font-bold text-navy mb-2">{group.cfaName}</h2>
              <WeekGrid
                monday={monday}
                items={group.items}
                dayStart={dayStart}
                totalMin={totalMin}
                colorByTrainer={colorByTrainer}
                allTrainers={trainers ?? []}
                weekParam={searchParams.w ?? ''}
                cfaParam={cfaFilter ?? ''}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WeekGrid({
  monday, items, dayStart, totalMin, colorByTrainer, allTrainers, weekParam, cfaParam,
}: {
  monday: Date; items: any[]; dayStart: number; totalMin: number
  colorByTrainer: Record<string, { bg: string; border: string; text: string }>
  allTrainers: any[]
  weekParam: string
  cfaParam: string
}) {
  const returnTo = `/planning?w=${weekParam || iso(monday)}${cfaParam ? `&cfa=${cfaParam}` : ''}`
  return (
    <div className="card p-0 overflow-visible">
      <div className="grid overflow-visible" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
        <div className="bg-gray-50 border-b border-gray-200 border-r" style={{ height: 48 }}></div>
        {DAYS.map(d => {
          const date = addDays(monday, d.num)
          return (
            <div key={d.num} className="bg-gray-50 border-b border-gray-200 text-center py-1" style={{ height: 48 }}>
              <div className="text-xs font-bold text-navy">{d.label}</div>
              <div className="text-[10px] text-gray-500">{String(date.getDate()).padStart(2, '0')}/{String(date.getMonth() + 1).padStart(2, '0')}</div>
            </div>
          )
        })}

        {/* Colonne horaire */}
        <div className="relative border-r border-gray-200" style={{ height: totalMin * PX_PER_MIN }}>
          {Array.from({ length: 13 }).map((_, i) => {
            const h = 8 + i
            return (
              <div key={h} className="absolute left-0 right-0 text-[10px] text-gray-500 pl-1 border-t border-gray-100"
                style={{ top: i * 60 * PX_PER_MIN, height: 60 * PX_PER_MIN }}>
                {h}h
              </div>
            )
          })}
        </div>

        {/* Colonne par jour */}
        {DAYS.map(day => {
          const dayDate = iso(addDays(monday, day.num))
          const dayItems = items.filter(it => it.session_date === dayDate)
          const laidOut = layoutItemsForDay(dayItems)
          return (
            <div key={day.num} className="relative border-r border-gray-200" style={{ height: totalMin * PX_PER_MIN }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="absolute left-0 right-0 border-t border-gray-100"
                  style={{ top: (i + 1) * 60 * PX_PER_MIN }} />
              ))}
              {laidOut.map(({ item, column, maxCols }, idx) => {
                const top = (toMin(item.start_time) - dayStart) * PX_PER_MIN
                const height = (toMin(item.end_time) - toMin(item.start_time)) * PX_PER_MIN
                const c = (item.trainer_id && colorByTrainer[item.trainer_id]) || NO_TRAINER_COLOR
                const widthPct = 100 / maxCols
                const leftPct = column * widthPct
                const trainerRate = Number(item.trainer?.hourly_rate_default) || 0
                const isTemplate = item.kind === 'template'
                const blockContent = (
                  <div className="p-1 text-[10px] leading-tight font-semibold">
                    <div className="flex items-center gap-1">
                      {isTemplate && <span title="Créneau récurrent (non instancié)">▶</span>}
                      <span>{item.start_time}-{item.end_time}</span>
                    </div>
                    <div className="truncate">{item.trainer ? `${item.trainer.first_name} ${item.trainer.last_name}` : 'À POURVOIR'}</div>
                    <div className="truncate opacity-80">{item.formation?.code ?? ''}</div>
                    {item.trainer && trainerRate > 0 && (
                      <div className="truncate opacity-70">{trainerRate} €/h</div>
                    )}
                  </div>
                )
                // Templates (récurrents non instanciés) : pas d'action possible, affichage statique
                if (isTemplate || !item.session_id) {
                  return (
                    <div key={idx} className="absolute rounded border overflow-hidden"
                      style={{
                        top, height,
                        background: c.bg, borderColor: c.border, color: c.text,
                        left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)`,
                        borderStyle: 'dashed',
                      }}>
                      {blockContent}
                    </div>
                  )
                }
                // Séances concrètes : popover d'action (remplacement + déprogrammer)
                return (
                  <details key={idx} className="group absolute rounded border open:z-30 open:shadow-xl cursor-pointer"
                    style={{
                      top, height,
                      background: c.bg, borderColor: c.border, color: c.text,
                      left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)`,
                    }}>
                    <summary className="list-none overflow-hidden" style={{ maxHeight: height }}>
                      {blockContent}
                    </summary>
                    <div className="absolute left-0 top-full mt-1 p-2 bg-white border rounded shadow-xl text-[10px] w-[240px] max-w-[90vw] z-50 max-h-[70vh] overflow-y-auto space-y-2 text-gray-900"
                      style={{ borderColor: c.border }}>
                      <div className="font-semibold text-navy text-xs">
                        {item.start_time}-{item.end_time} · {fmtDate(item.session_date)}
                      </div>
                      <div className="text-[10px] text-gray-600 pb-1 border-b">
                        <div>{item.mission?.name ?? '—'}</div>
                        <div className="text-gray-500">{item.cfa?.name ?? '—'} · {item.formation?.code ?? ''}</div>
                        <div className="mt-1"><b>Formateur actuel :</b> {item.trainer ? `${item.trainer.first_name} ${item.trainer.last_name}` : <span className="text-red-700 font-semibold">À POURVOIR</span>}</div>
                      </div>

                      <form action={assignSubstitute} className="space-y-1">
                        <input type="hidden" name="session_id" value={item.session_id} />
                        <input type="hidden" name="return_to" value={returnTo} />
                        <label className="font-semibold text-[10px]">
                          {item.trainer ? 'Programmer un remplaçant' : 'Affecter un formateur'}
                        </label>
                        <select name="trainer_id" required className="w-full border rounded px-1 py-0.5">
                          <option value="">— Choisir le formateur —</option>
                          {allTrainers.filter((t: any) => t.id !== item.trainer_id).map((t: any) => (
                            <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                          ))}
                        </select>
                        <button className="btn btn-sm btn-primary w-full">
                          {item.trainer ? 'Programmer le remplacement' : 'Affecter'}
                        </button>
                      </form>

                      {item.trainer && (
                        <form action={clearSessionTrainer} className="pt-1 border-t border-gray-200">
                          <input type="hidden" name="session_id" value={item.session_id} />
                          <input type="hidden" name="return_to" value={returnTo} />
                          <button className="btn btn-sm btn-danger w-full">
                            Déprogrammer le formateur
                          </button>
                          <div className="text-[9px] text-gray-500 mt-1">Le créneau devient « À POURVOIR » et apparaît dans la file des remplacements.</div>
                        </form>
                      )}
                    </div>
                  </details>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
