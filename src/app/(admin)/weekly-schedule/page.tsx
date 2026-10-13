import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { upsertSlot, deleteSlot, generateSessionsFromSchedule } from '@/actions/weekly-schedule'
import { trainerColor } from '@/lib/trainer-colors'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const DAYS = [
  { num: 1, label: 'Lundi' },
  { num: 2, label: 'Mardi' },
  { num: 3, label: 'Mercredi' },
  { num: 4, label: 'Jeudi' },
  { num: 5, label: 'Vendredi' },
  { num: 6, label: 'Samedi' },
  { num: 7, label: 'Dimanche' },
]

// Créneaux horaires de 8h à 20h, pas de 30 min pour laisser de la souplesse
const HOURS: string[] = []
for (let h = 8; h <= 20; h++) {
  HOURS.push(`${String(h).padStart(2, '0')}:00`)
  if (h < 20) HOURS.push(`${String(h).padStart(2, '0')}:30`)
}

/** Convertit "HH:MM" en nombre de minutes depuis minuit. */
function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
/** Hauteur en pixels d'un créneau de X minutes (1 min = 1 px → 1h = 60px). */
const PX_PER_MIN = 1.1

/**
 * Attribue à chaque créneau une colonne et un nombre total de colonnes pour que
 * les créneaux qui se chevauchent (ex. 2 formateurs sur la même plage horaire)
 * s'affichent côte à côte au lieu de se cacher.
 */
function layoutSlotsForDay(slots: any[]): { slot: any; column: number; maxCols: number }[] {
  if (slots.length === 0) return []
  const sorted = [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time) || a.end_time.localeCompare(b.end_time))
  type Active = { end: number; col: number }
  const active: Active[] = []
  const assigned: { slot: any; column: number; maxCols: number }[] = []
  for (const sl of sorted) {
    const st = toMin(sl.start_time), en = toMin(sl.end_time)
    // Libérer les colonnes dont le créneau est terminé
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].end <= st) active.splice(i, 1)
    }
    // Prendre la première colonne libre
    const used = new Set(active.map(a => a.col))
    let col = 0
    while (used.has(col)) col++
    active.push({ end: en, col })
    assigned.push({ slot: sl, column: col, maxCols: 1 })
  }
  // Calcul du max de colonnes concurrentes vu depuis chaque créneau
  for (const a of assigned) {
    const st = toMin(a.slot.start_time), en = toMin(a.slot.end_time)
    let maxCol = 0
    for (const b of assigned) {
      const bst = toMin(b.slot.start_time), ben = toMin(b.slot.end_time)
      if (bst < en && ben > st) maxCol = Math.max(maxCol, b.column + 1)
    }
    a.maxCols = maxCol
  }
  return assigned
}

export default async function WeeklySchedulePage({ searchParams }: { searchParams: { cfa?: string; mode?: string } }) {
  const s = createClient()
  const [{ data: cfas }, { data: trainers }, { data: formations }, { data: allSlots }, { data: missions }] = await Promise.all([
    s.from('cfa').select('id, name, city').is('archived_at', null).order('name'),
    s.from('trainers').select('id, first_name, last_name').eq('active', true).order('last_name'),
    s.from('formations').select('id, code, name, competence_blocks(id, number, title)').is('archived_at', null).order('name'),
    s.from('weekly_schedule_slots').select('*, cfa:cfa(id, name), trainer:trainers(first_name, last_name), formation:formations(code, name), block:competence_blocks(number, title)'),
    s.from('missions').select('id, name, cfa_id').is('archived_at', null).order('name'),
  ])

  const mode = searchParams.mode === 'all' ? 'all' : 'single'
  const selectedCfaId = mode === 'all' ? null : (searchParams.cfa ?? cfas?.[0]?.id ?? null)
  const slotsOfCfa = (cfaId: string | null) => (allSlots ?? []).filter((sl: any) => cfaId ? sl.cfa_id === cfaId : true)

  const dayStart = toMin('08:00')
  const dayEnd = toMin('20:00')
  const totalMin = dayEnd - dayStart

  return (
    <div>
      <PageHeader
        title="Planning hebdomadaire récurrent"
        subtitle="Grille horaire 8h-20h. Chaque case est un créneau (cours ou pause). Les couleurs identifient les formateurs."
      />

      {/* Barre de navigation CFA + mode */}
      <div className="card p-3 mb-4 bg-brand-light/30">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-navy uppercase tracking-wider mr-2">Vue :</span>
          {(cfas ?? []).map((c: any) => (
            <Link key={c.id} href={`/weekly-schedule?cfa=${c.id}`}
              className={`px-3 py-1.5 rounded text-sm font-medium ${selectedCfaId === c.id && mode === 'single' ? 'bg-navy text-white' : 'bg-white text-navy border border-gray-200 hover:bg-brand-light'}`}>
              {c.name}
            </Link>
          ))}
          <Link href="/weekly-schedule?mode=all"
            className={`px-3 py-1.5 rounded text-sm font-medium ${mode === 'all' ? 'bg-navy text-white' : 'bg-white text-navy border border-gray-200 hover:bg-brand-light'}`}>
            Tous les CFA
          </Link>
        </div>
      </div>

      {/* Légende formateurs */}
      <div className="card p-3 mb-4">
        <div className="text-xs font-semibold text-navy uppercase tracking-wider mb-2">Formateurs — codes couleur</div>
        <div className="flex flex-wrap gap-2">
          {(trainers ?? []).map((t: any) => {
            const c = trainerColor(t.id)
            return (
              <span key={t.id} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                <span className="w-2 h-2 rounded-full" style={{ background: c.border }} />
                {t.first_name} {t.last_name}
              </span>
            )
          })}
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-100 border border-amber-500 text-amber-800">
            Pause déjeuner / pause
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-100 border border-blue-500 text-blue-800">
            Événement (business game, examen...)
          </span>
        </div>
      </div>

      {/* Grille planning */}
      {mode === 'all' ? (
        <div className="space-y-6">
          {(cfas ?? []).map((c: any) => (
            <div key={c.id}>
              <h2 className="text-lg font-bold text-navy mb-2">{c.name}</h2>
              <PlanningGrid
                cfaId={c.id} slots={slotsOfCfa(c.id)} dayStart={dayStart} dayEnd={dayEnd} totalMin={totalMin}
                trainers={trainers ?? []} formations={formations ?? []}
              />
            </div>
          ))}
        </div>
      ) : selectedCfaId ? (
        <>
          <PlanningGrid
            cfaId={selectedCfaId} slots={slotsOfCfa(selectedCfaId)} dayStart={dayStart} dayEnd={dayEnd} totalMin={totalMin}
            trainers={trainers ?? []} formations={formations ?? []}
          />

          {/* Formulaire d'ajout d'un créneau */}
          <div className="card mt-5">
            <div className="card-header"><div className="card-title">Ajouter un créneau</div></div>
            <form action={upsertSlot} className="card-body grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
              <input type="hidden" name="cfa_id" value={selectedCfaId} />
              <div className="field mb-0">
                <label className="text-[11px] font-semibold">Jour</label>
                <select name="weekday" required className="text-sm border rounded px-2 py-1 w-full">
                  {DAYS.map(d => <option key={d.num} value={d.num}>{d.label}</option>)}
                </select>
              </div>
              <div className="field mb-0">
                <label className="text-[11px] font-semibold">Début</label>
                <select name="start_time" required defaultValue="09:00" className="text-sm border rounded px-2 py-1 w-full">
                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="field mb-0">
                <label className="text-[11px] font-semibold">Fin</label>
                <select name="end_time" required defaultValue="12:00" className="text-sm border rounded px-2 py-1 w-full">
                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="field mb-0">
                <label className="text-[11px] font-semibold">Type</label>
                <select name="kind" defaultValue="lesson" className="text-sm border rounded px-2 py-1 w-full">
                  <option value="lesson">Cours</option>
                  <option value="lunch_break">Pause déjeuner</option>
                  <option value="break">Pause</option>
                  <option value="event">Événement</option>
                </select>
              </div>
              <div className="field mb-0">
                <label className="text-[11px] font-semibold">Formateur</label>
                <select name="trainer_id" className="text-sm border rounded px-2 py-1 w-full">
                  <option value="">—</option>
                  {trainers?.map((t: any) => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                </select>
              </div>
              <div className="field mb-0">
                <label className="text-[11px] font-semibold">Matière / formation</label>
                <select name="formation_id" className="text-sm border rounded px-2 py-1 w-full">
                  <option value="">—</option>
                  {formations?.map((f: any) => <option key={f.id} value={f.id}>{f.code} — {f.name}</option>)}
                </select>
              </div>
              <div className="field mb-0 md:col-span-3">
                <label className="text-[11px] font-semibold">Salle (optionnel)</label>
                <input name="room" placeholder="Ex : Salle B12" className="text-sm border rounded px-2 py-1 w-full" />
              </div>
              <div className="field mb-0 md:col-span-2">
                <label className="text-[11px] font-semibold">Intitulé libre (pour événement, etc.)</label>
                <input name="label" placeholder="Ex : Business Game" className="text-sm border rounded px-2 py-1 w-full" />
              </div>
              <button className="btn btn-primary">Ajouter</button>
            </form>
          </div>

          {/* Génération automatique des séances */}
          <div className="card mt-5 border-l-4 border-l-brand">
            <div className="card-header">
              <div>
                <div className="card-title">Instancier automatiquement les séances</div>
                <div className="text-xs text-gray-500 mt-0.5">Transforme ce planning hebdo en séances concrètes sur la période choisie. Les créneaux « pause » sont ignorés. Les doublons sont évités.</div>
              </div>
            </div>
            <form action={generateSessionsFromSchedule} className="card-body grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
              <input type="hidden" name="cfa_id" value={selectedCfaId} />
              <div className="field mb-0">
                <label className="text-[11px] font-semibold">Date début</label>
                <input name="start_date" type="date" required className="text-sm border rounded px-2 py-1 w-full" />
              </div>
              <div className="field mb-0">
                <label className="text-[11px] font-semibold">Date fin</label>
                <input name="end_date" type="date" required className="text-sm border rounded px-2 py-1 w-full" />
              </div>
              <div className="field mb-0">
                <label className="text-[11px] font-semibold">Tarif CFA (€ HT / h)</label>
                <input name="cfa_hourly_rate" type="number" step="0.01" placeholder="Ex : 55" className="text-sm border rounded px-2 py-1 w-full" />
                <p className="text-[10px] text-gray-500">Appliqué à la mission générée (facturation CFA).</p>
              </div>
              <div className="field mb-0">
                <label className="text-[11px] font-semibold">Tarif formateur (€ HT / h)</label>
                <input name="trainer_hourly_rate" type="number" step="0.01" placeholder="Vide = tarif par défaut de chaque formateur" className="text-sm border rounded px-2 py-1 w-full" />
                <p className="text-[10px] text-gray-500">Si vide, chaque formateur sera rémunéré à son tarif indiqué dans sa fiche.</p>
              </div>
              <div className="field mb-0 md:col-span-3">
                <label className="text-[11px] font-semibold">Rattacher les séances à</label>
                <select name="mission_choice" defaultValue="generic" className="text-sm border rounded px-2 py-1 w-full">
                  <option value="generic">Créer / réutiliser une mission générique avec les tarifs ci-dessus</option>
                  <option value="existing">Une mission existante du CFA :</option>
                </select>
                <select name="mission_id" className="text-sm border rounded px-2 py-1 w-full mt-1">
                  <option value="">— Choisir une mission si « existante » —</option>
                  {(missions ?? []).filter((m: any) => m.cfa_id === selectedCfaId).map((m: any) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary">Générer les séances</button>
            </form>
            <div className="card-body border-t border-gray-100 bg-amber-50 text-xs text-amber-800">
              <b>À retenir :</b> les tarifs saisis sont enregistrés sur la mission générée (ou mise à jour si réutilisée).
              Si vous rattachez à une mission existante, ses tarifs sont écrasés par ceux ci-dessus seulement si vous renseignez des valeurs &gt; 0.
              Les créneaux « Pause » du planning hebdo sont ignorés — seules les séances de cours et événements créent des séances.
            </div>
          </div>
        </>
      ) : (
        <div className="card p-8 text-center text-gray-500">Aucun CFA. Créez-en un depuis le menu CFA / Écoles.</div>
      )}
    </div>
  )
}

// Composant grille planning. Server component rendu statiquement.
function PlanningGrid({
  cfaId, slots, dayStart, dayEnd, totalMin, trainers, formations,
}: {
  cfaId: string; slots: any[]; dayStart: number; dayEnd: number; totalMin: number
  trainers: any[]; formations: any[]
}) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="grid" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
        <div className="bg-gray-50 border-b border-gray-200 border-r" style={{ height: 32 }}></div>
        {DAYS.map(d => (
          <div key={d.num} className="bg-gray-50 border-b border-gray-200 text-center text-xs font-bold text-navy py-2" style={{ height: 32 }}>
            {d.label}
          </div>
        ))}

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
          const daySlots = slots.filter(s => s.weekday === day.num)
          const laidOut = layoutSlotsForDay(daySlots)
          return (
            <div key={day.num} className="relative border-r border-gray-200" style={{ height: totalMin * PX_PER_MIN }}>
              {/* Lignes de guidage horaires */}
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="absolute left-0 right-0 border-t border-gray-100"
                  style={{ top: (i + 1) * 60 * PX_PER_MIN }} />
              ))}
              {/* Créneaux (positionnés côte à côte si chevauchement) */}
              {laidOut.map(({ slot: sl, column, maxCols }) => {
                const top = (toMin(sl.start_time) - dayStart) * PX_PER_MIN
                const height = (toMin(sl.end_time) - toMin(sl.start_time)) * PX_PER_MIN
                const isLunch = sl.kind === 'lunch_break' || sl.kind === 'break'
                const isEvent = sl.kind === 'event'
                let bg = '#fff', border = '#d1d5db', text = '#111827'
                if (isLunch) { bg = '#fef3c7'; border = '#f59e0b'; text = '#92400e' }
                else if (isEvent) { bg = '#dbeafe'; border = '#3b82f6'; text = '#1e40af' }
                else {
                  const c = trainerColor(sl.trainer_id)
                  bg = c.bg; border = c.border; text = c.text
                }
                const widthPct = 100 / maxCols
                const leftPct = column * widthPct
                return (
                  <SlotCell key={sl.id} slot={sl} top={top} height={height} bg={bg} border={border} text={text}
                    leftPct={leftPct} widthPct={widthPct}
                    trainers={trainers} formations={formations} cfaId={cfaId} />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SlotCell({ slot, top, height, bg, border, text, leftPct, widthPct, trainers, formations, cfaId }: {
  slot: any; top: number; height: number; bg: string; border: string; text: string
  leftPct: number; widthPct: number
  trainers: any[]; formations: any[]; cfaId: string
}) {
  return (
    <details className="absolute rounded border overflow-hidden"
      style={{ top, height, background: bg, borderColor: border,
               left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)` }}>
      <summary className="cursor-pointer p-1 text-[10px] leading-tight font-semibold select-none" style={{ color: text }}>
        <div>{slot.start_time.slice(0,5)}-{slot.end_time.slice(0,5)}</div>
        {slot.kind === 'lesson' && <>
          <div className="truncate">{slot.trainer ? `${slot.trainer.first_name} ${slot.trainer.last_name}` : 'À pourvoir'}</div>
          <div className="truncate opacity-80">{slot.formation?.code ?? ''}{slot.block ? ` · B${slot.block.number}` : ''}</div>
        </>}
        {slot.kind === 'lunch_break' && <div>Pause déjeuner</div>}
        {slot.kind === 'break' && <div>Pause</div>}
        {slot.kind === 'event' && <div className="truncate">{slot.label ?? 'Événement'}</div>}
      </summary>
      <div className="p-2 bg-white border-t text-[10px] space-y-1">
        <form action="/weekly-schedule" className="hidden" />
        <EditForm slot={slot} trainers={trainers} formations={formations} cfaId={cfaId} />
      </div>
    </details>
  )
}

function EditForm({ slot, trainers, formations, cfaId }: { slot: any; trainers: any[]; formations: any[]; cfaId: string }) {
  return (
    <>
      <form action={upsertSlot} className="space-y-1 text-[10px]">
        <input type="hidden" name="id" value={slot.id} />
        <input type="hidden" name="cfa_id" value={cfaId} />
        <input type="hidden" name="weekday" value={slot.weekday} />
        <div className="flex gap-1">
          <input name="start_time" type="time" defaultValue={slot.start_time?.slice(0,5)} required className="border rounded px-1 py-0.5 flex-1" />
          <input name="end_time" type="time" defaultValue={slot.end_time?.slice(0,5)} required className="border rounded px-1 py-0.5 flex-1" />
        </div>
        <select name="kind" defaultValue={slot.kind} className="border rounded px-1 py-0.5 w-full">
          <option value="lesson">Cours</option>
          <option value="lunch_break">Pause déjeuner</option>
          <option value="break">Pause</option>
          <option value="event">Événement</option>
        </select>
        <select name="trainer_id" defaultValue={slot.trainer_id ?? ''} className="border rounded px-1 py-0.5 w-full">
          <option value="">— Formateur —</option>
          {trainers.map((t: any) => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
        </select>
        <select name="formation_id" defaultValue={slot.formation_id ?? ''} className="border rounded px-1 py-0.5 w-full">
          <option value="">— Matière —</option>
          {formations.map((f: any) => <option key={f.id} value={f.id}>{f.code}</option>)}
        </select>
        <input name="room" defaultValue={slot.room ?? ''} placeholder="Salle" className="border rounded px-1 py-0.5 w-full" />
        <input name="label" defaultValue={slot.label ?? ''} placeholder="Intitulé" className="border rounded px-1 py-0.5 w-full" />
        <button className="btn btn-sm btn-primary w-full">Enregistrer</button>
      </form>
      <form action={deleteSlot}>
        <input type="hidden" name="id" value={slot.id} />
        <input type="hidden" name="cfa_id" value={cfaId} />
        <button className="btn btn-sm btn-danger w-full">Supprimer</button>
      </form>
    </>
  )
}
