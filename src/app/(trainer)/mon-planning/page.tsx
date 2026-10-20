import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtHours, requireTrainer } from '@/lib/utils'
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

// Palette fixe pour les CFA côté formateur (couleur par CFA pour distinguer rapidement)
const CFA_PALETTE = [
  { bg: '#dbeafe', border: '#2563eb', text: '#1e3a8a' },
  { bg: '#dcfce7', border: '#16a34a', text: '#14532d' },
  { bg: '#fef3c7', border: '#d97706', text: '#78350f' },
  { bg: '#fce7f3', border: '#db2777', text: '#831843' },
  { bg: '#e0e7ff', border: '#4f46e5', text: '#312e81' },
  { bg: '#ccfbf1', border: '#0d9488', text: '#134e4a' },
  { bg: '#fed7aa', border: '#ea580c', text: '#7c2d12' },
  { bg: '#e9d5ff', border: '#9333ea', text: '#581c87' },
]

export default async function TrainerPlanningPage({ searchParams }: { searchParams: { w?: string } }) {
  const { trainer } = await requireTrainer()
  if (!trainer) return <div className="card p-6 text-sm">Pas de fiche formateur liée à votre compte.</div>

  const s = createClient()
  const monday = parseWeekFrom(searchParams.w)
  const sunday = addDays(monday, 6)
  const prevWeek = iso(addDays(monday, -7))
  const nextWeek = iso(addDays(monday, 7))

  const [{ data: sessions }, { data: templateSlots }] = await Promise.all([
    s.from('mission_sessions')
      .select('id, session_date, start_time, end_time, room, trainer_id, cfa_id, break_minutes, mission:missions(name, formation:formations(code, name), cfa:cfa(id, name)), cfa:cfa(id, name)')
      .eq('trainer_id', trainer.id)
      .gte('session_date', iso(monday))
      .lte('session_date', iso(sunday))
      .order('session_date').order('start_time'),
    s.from('weekly_schedule_slots')
      .select('id, cfa_id, weekday, start_time, end_time, kind, room, label, trainer_id, formation:formations(code, name), cfa:cfa(id, name)')
      .eq('trainer_id', trainer.id)
      .in('kind', ['lesson', 'event']),
  ])

  const concreteByKey = new Set<string>()
  const items: any[] = []

  for (const se of sessions ?? []) {
    const cfaObj = (se as any).mission?.cfa ?? (se as any).cfa ?? null
    const cfaId = cfaObj?.id ?? null
    const key = `${(se as any).session_date}|${(se as any).start_time?.slice(0,5)}|${cfaId}`
    concreteByKey.add(key)
    items.push({
      kind: 'real',
      session_date: (se as any).session_date,
      start_time: (se as any).start_time?.slice(0,5),
      end_time: (se as any).end_time?.slice(0,5),
      break_minutes: (se as any).break_minutes ?? 0,
      room: (se as any).room,
      cfa: cfaObj ?? { id: cfaId, name: 'Sans CFA' },
      mission: (se as any).mission,
      formation: (se as any).mission?.formation,
      sessionId: (se as any).id,
    })
  }

  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const date = iso(addDays(monday, dayIdx))
    const pgWeekday = dayIdx + 1
    for (const sl of templateSlots ?? []) {
      if ((sl as any).weekday !== pgWeekday) continue
      const cfaObj = (sl as any).cfa ?? null
      const cfaId = cfaObj?.id ?? (sl as any).cfa_id
      const key = `${date}|${(sl as any).start_time?.slice(0,5)}|${cfaId}`
      if (concreteByKey.has(key)) continue
      items.push({
        kind: 'template',
        session_date: date,
        start_time: (sl as any).start_time?.slice(0,5),
        end_time: (sl as any).end_time?.slice(0,5),
        break_minutes: 0,
        room: (sl as any).room,
        cfa: cfaObj ?? { id: cfaId, name: 'Sans CFA' },
        mission: null,
        formation: (sl as any).formation,
      })
    }
  }

  // KPIs (sans tarif/CA côté formateur)
  let totalHours = 0
  for (const it of items) {
    const durationMin = toMin(it.end_time) - toMin(it.start_time) - (it.break_minutes ?? 0)
    totalHours += Math.max(0, durationMin / 60)
  }

  // Couleur par CFA
  const cfaIds = Array.from(new Set(items.map(it => it.cfa?.id).filter(Boolean))).sort()
  const colorByCfa: Record<string, { bg: string; border: string; text: string }> = {}
  cfaIds.forEach((id, i) => { colorByCfa[id] = CFA_PALETTE[i % CFA_PALETTE.length] })

  const dayStart = toMin('08:00')
  const dayEnd = toMin('20:00')
  const totalMin = dayEnd - dayStart

  const cfaLegend = cfaIds.map(id => {
    const name = items.find(it => it.cfa?.id === id)?.cfa?.name ?? '—'
    return { id, name, c: colorByCfa[id] }
  })

  return (
    <div>
      <PageHeader
        title="Mon planning de la semaine"
        subtitle={`Du ${fmtDate(iso(monday))} au ${fmtDate(iso(sunday))} — ${items.length} créneau${items.length > 1 ? 'x' : ''}`}
      />

      {/* Navigation semaine */}
      <div className="card p-3 mb-4 flex flex-wrap items-center gap-2 bg-brand-light/30">
        <Link href={`/mon-planning?w=${prevWeek}`} className="btn btn-sm btn-outline">← Semaine précédente</Link>
        <Link href="/mon-planning" className="btn btn-sm btn-outline">Cette semaine</Link>
        <Link href={`/mon-planning?w=${nextWeek}`} className="btn btn-sm btn-outline">Semaine suivante →</Link>
        <div className="ml-auto text-xs text-gray-600">
          <b className="text-navy">{fmtHours(totalHours)}</b> planifiées cette semaine
        </div>
      </div>

      {/* Légende CFA */}
      {cfaLegend.length > 0 && (
        <div className="card p-3 mb-4">
          <div className="text-xs font-semibold text-navy uppercase tracking-wider mb-2">Vos CFA cette semaine</div>
          <div className="flex flex-wrap gap-2">
            {cfaLegend.map(cfa => (
              <span key={cfa.id} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                style={{ background: cfa.c.bg, border: `1px solid ${cfa.c.border}`, color: cfa.c.text }}>
                <span className="w-2 h-2 rounded-full" style={{ background: cfa.c.border }} />
                {cfa.name}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-600 border border-dashed border-gray-400">
              ▶ Créneau récurrent (non encore validé)
            </span>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          Aucun créneau programmé pour vous cette semaine.
          <div className="text-xs mt-2 text-gray-400">Vos séances apparaîtront ici dès qu'elles seront planifiées par l'administration.</div>
        </div>
      ) : (
        <WeekGrid
          monday={monday}
          items={items}
          dayStart={dayStart}
          totalMin={totalMin}
          colorByCfa={colorByCfa}
        />
      )}
    </div>
  )
}

function WeekGrid({
  monday, items, dayStart, totalMin, colorByCfa,
}: {
  monday: Date; items: any[]; dayStart: number; totalMin: number
  colorByCfa: Record<string, { bg: string; border: string; text: string }>
}) {
  const NEUTRAL = { bg: '#f3f4f6', border: '#9ca3af', text: '#374151' }
  return (
    <div className="card p-0 overflow-hidden">
      <div className="grid" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
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
                const c = (item.cfa?.id && colorByCfa[item.cfa.id]) || NEUTRAL
                const widthPct = 100 / maxCols
                const leftPct = column * widthPct
                const isTemplate = item.kind === 'template'
                const inner = (
                  <div className="p-1 text-[10px] leading-tight font-semibold">
                    <div className="flex items-center gap-1">
                      {isTemplate && <span title="Créneau récurrent">▶</span>}
                      <span>{item.start_time}-{item.end_time}</span>
                    </div>
                    <div className="truncate">{item.cfa?.name ?? '—'}</div>
                    <div className="truncate opacity-80">{item.formation?.code ?? ''}</div>
                    {item.room && <div className="truncate opacity-70">Salle {item.room}</div>}
                  </div>
                )
                const style = {
                  top, height,
                  background: c.bg, borderColor: c.border, color: c.text,
                  left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)`,
                  borderStyle: isTemplate ? 'dashed' as const : 'solid' as const,
                }
                if (item.sessionId) {
                  return (
                    <Link key={idx} href={`/sessions/${item.sessionId}`}
                      className="absolute rounded border overflow-hidden hover:ring-2 hover:ring-navy transition-all"
                      style={style}>
                      {inner}
                    </Link>
                  )
                }
                return (
                  <div key={idx} className="absolute rounded border overflow-hidden" style={style}>
                    {inner}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
