import Link from 'next/link'

/**
 * Grille horaire 8h-20h × 7 jours, server-side.
 * Chaque item doit avoir : session_date (YYYY-MM-DD), start_time ("HH:MM"), end_time ("HH:MM"),
 *   et de quoi colorer / étiqueter (voir props).
 *
 * Un item peut porter `href` → le bloc devient cliquable (ouvre la fiche détail).
 *
 * Utilisée par :
 * - /planning (admin, par CFA, couleur par formateur)
 * - /mon-planning (formateur, couleur par CFA)
 * - /dashboard (admin, mode grille des saisies validées, couleur par formateur)
 * - /sessions (formateur, mode grille, couleur par CFA)
 */
export const DAYS_FR = [
  { num: 0, label: 'Lundi' },
  { num: 1, label: 'Mardi' },
  { num: 2, label: 'Mercredi' },
  { num: 3, label: 'Jeudi' },
  { num: 4, label: 'Vendredi' },
  { num: 5, label: 'Samedi' },
  { num: 6, label: 'Dimanche' },
]
const PX_PER_MIN = 1.1

export function toMin(hhmm: string): number {
  if (!hhmm) return 0
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
export function isoDate(d: Date) { return d.toISOString().slice(0, 10) }
export function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(d.getDate() + n); return r }
export function mondayOfWeek(d: Date): Date {
  const dow = (d.getDay() + 6) % 7
  const m = new Date(d); m.setDate(d.getDate() - dow); m.setHours(0, 0, 0, 0)
  return m
}

/** Attribue colonne et nombre total de colonnes concurrentes pour affichage côte à côte. */
export function layoutItemsForDay<T extends { start_time: string; end_time: string }>(items: T[]) {
  if (items.length === 0) return [] as { item: T; column: number; maxCols: number }[]
  const sorted = [...items].sort((a, b) => a.start_time.localeCompare(b.start_time) || a.end_time.localeCompare(b.end_time))
  type Active = { end: number; col: number }
  const active: Active[] = []
  const assigned: { item: T; column: number; maxCols: number }[] = []
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

type Palette = { bg: string; border: string; text: string }

export type WeekGridItem = {
  session_date: string
  start_time: string
  end_time: string
  colorKey?: string | null
  line1?: string      // ex. horaires (si absent → calculé)
  line2?: string      // ex. nom formateur / CFA
  line3?: string      // ex. code formation
  line4?: string      // ex. salle ou tarif
  dashed?: boolean    // bordure pointillée (créneau récurrent non instancié)
  href?: string       // si fourni → le bloc est cliquable (ouvre la fiche détail)
  title?: string      // tooltip au survol
}

export function WeekGrid({
  monday, items, colorByKey, unassignedColor,
}: {
  monday: Date
  items: WeekGridItem[]
  colorByKey: Record<string, Palette>
  unassignedColor: Palette
}) {
  const dayStart = toMin('08:00')
  const dayEnd = toMin('20:00')
  const totalMin = dayEnd - dayStart

  return (
    <div className="card p-0 overflow-hidden">
      <div className="grid" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
        <div className="bg-gray-50 border-b border-gray-200 border-r" style={{ height: 48 }}></div>
        {DAYS_FR.map(d => {
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

        {DAYS_FR.map(day => {
          const dayDate = isoDate(addDays(monday, day.num))
          const dayItems = items.filter(it => it.session_date === dayDate)
          const laid = layoutItemsForDay(dayItems)
          return (
            <div key={day.num} className="relative border-r border-gray-200" style={{ height: totalMin * PX_PER_MIN }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="absolute left-0 right-0 border-t border-gray-100"
                  style={{ top: (i + 1) * 60 * PX_PER_MIN }} />
              ))}
              {laid.map(({ item, column, maxCols }, idx) => {
                const top = (toMin(item.start_time) - dayStart) * PX_PER_MIN
                const height = (toMin(item.end_time) - toMin(item.start_time)) * PX_PER_MIN
                const c = (item.colorKey && colorByKey[item.colorKey]) || unassignedColor
                const widthPct = 100 / maxCols
                const leftPct = column * widthPct
                const style = {
                  top, height,
                  background: c.bg, borderColor: c.border, color: c.text,
                  left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)`,
                  borderStyle: item.dashed ? 'dashed' as const : 'solid' as const,
                }
                const inner = (
                  <div className="p-1 text-[10px] leading-tight font-semibold">
                    <div>{item.line1 ?? `${item.start_time}-${item.end_time}`}</div>
                    {item.line2 && <div className="truncate">{item.line2}</div>}
                    {item.line3 && <div className="truncate opacity-80">{item.line3}</div>}
                    {item.line4 && <div className="truncate opacity-70">{item.line4}</div>}
                  </div>
                )
                if (item.href) {
                  return (
                    <Link key={idx} href={item.href} title={item.title ?? 'Ouvrir le détail'}
                      className="absolute rounded border overflow-hidden hover:ring-2 hover:ring-navy transition-all cursor-pointer"
                      style={style}>
                      {inner}
                    </Link>
                  )
                }
                return (
                  <div key={idx} title={item.title} className="absolute rounded border overflow-hidden" style={style}>
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
