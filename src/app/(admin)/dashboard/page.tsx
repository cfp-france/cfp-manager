import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtEuro, fmtHours } from '@/lib/utils'
import Link from 'next/link'
import { unvalidateEntry } from '@/actions/entries'
import { WeekGrid, mondayOfWeek, isoDate, addDays } from '@/components/WeekGrid'
import { buildTrainerColorMap, NO_TRAINER_COLOR } from '@/lib/trainer-colors'

export const dynamic = 'force-dynamic'

const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']

function parseDate(v?: string): string | null {
 if (!v) return null
 return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

export default async function Dashboard({ searchParams }: { searchParams: { from?: string; to?: string; cfa?: string; trainer?: string; preset?: string; view?: string; vw?: string; scope?: string } }) {
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
 const trainerFilter = searchParams.trainer && searchParams.trainer !== '' ? searchParams.trainer : null

 // Liste des CFA et formateurs pour les filtres
 const [{ data: cfas }, { data: trainersList }] = await Promise.all([
  s.from('cfa').select('id, name').is('archived_at', null).order('name'),
  s.from('trainers').select('id, first_name, last_name').eq('active', true).order('last_name'),
 ])

 // Entrées validées sur la période (on charge aussi le tarif par défaut du CFA pour fallback)
 let query = s.from('time_entries')
 .select(`id, hours_actual, status, work_date, validated_at, session_id, trainer_id, actual_start, actual_end,
 trainer:trainers(first_name, last_name, hourly_rate_default),
 session:mission_sessions(mission_id, cfa_id, start_time, end_time,
 mission:missions(name, cfa_hourly_rate, trainer_hourly_rate, cfa:cfa(id, name, default_hourly_rate)),
 cfa:cfa(id, name, default_hourly_rate))`)
 .eq('status', 'validated')
 .gte('work_date', from)
 .lte('work_date', to)
 .order('work_date', { ascending: false })
 if (trainerFilter) query = query.eq('trainer_id', trainerFilter)
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
 const cfa: any = m?.cfa ?? e.session?.cfa
 // Priorité : tarif mission → tarif CFA par défaut → 0
 const cfaRate = Number(m?.cfa_hourly_rate) || Number(cfa?.default_hourly_rate) || 0
 // Priorité : tarif mission → tarif formateur par défaut → 0
 const trainerRate = Number(m?.trainer_hourly_rate) || Number(e.trainer?.hourly_rate_default) || 0
 totalHours += h
 ca += h * cfaRate
 cost += h * trainerRate
 }
 const margin = ca - cost
 const marginRate = ca > 0 ? Math.round((margin / ca) * 100) : 0

 // Alertes (toujours globales, pas filtrées)
 const [{ count: pendingCount }, { count: absCount }, { count: subCount }] = await Promise.all([
 s.from('time_entries').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
 s.from('trainer_absences').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
 s.from('mission_sessions').select('*', { count: 'exact', head: true }).eq('needs_substitution', true),
 ])

 // Planning de la semaine en cours (lundi → dimanche), groupé par CFA
 const now = new Date()
 const dow = (now.getDay() + 6) % 7  // 0=lundi
 const weekStart = new Date(now); weekStart.setDate(now.getDate() - dow)
 const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
 const weekFromStr = weekStart.toISOString().slice(0,10)
 const weekToStr = weekEnd.toISOString().slice(0,10)

 const [{ data: weekSessions }, { data: weekTemplates }] = await Promise.all([
  s.from('mission_sessions')
   .select('id, session_date, start_time, end_time, room, trainer_id, cfa_id, needs_substitution, mission:missions(name, cfa:cfa(id, name), formation:formations(code, name)), trainer:trainers(first_name, last_name), cfa:cfa(id, name)')
   .gte('session_date', weekFromStr)
   .lte('session_date', weekToStr)
   .order('session_date').order('start_time'),
  s.from('weekly_schedule_slots')
   .select('id, cfa_id, weekday, start_time, end_time, kind, room, trainer_id, trainer:trainers(first_name, last_name), formation:formations(code, name), cfa:cfa(id, name)')
   .in('kind', ['lesson', 'event']),
 ])

 // Projeter les créneaux récurrents sur chaque jour de la semaine, en évitant les doublons avec les séances concrètes
 const concreteKeys = new Set<string>()
 for (const se of weekSessions ?? []) {
  const cfaId = (se as any).mission?.cfa?.id ?? (se as any).cfa?.id ?? 'unknown'
  concreteKeys.add(`${(se as any).session_date}|${(se as any).start_time?.slice(0,5)}|${cfaId}`)
 }
 const projectedTemplates: any[] = []
 for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
  const date = isoDate(addDays(weekStart, dayIdx))
  const pgWeekday = dayIdx + 1
  for (const sl of weekTemplates ?? []) {
   if ((sl as any).weekday !== pgWeekday) continue
   const cfaId = (sl as any).cfa?.id ?? (sl as any).cfa_id
   const key = `${date}|${(sl as any).start_time?.slice(0,5)}|${cfaId}`
   if (concreteKeys.has(key)) continue
   projectedTemplates.push({
    ...sl,
    _isTemplate: true,
    session_date: date,
    cfa_id: cfaId,
    mission: null,
   })
  }
 }

 // Grouper par CFA — fusion séances concrètes + templates projetés
 const sessionsByCfa: Record<string, { cfaName: string; sessions: any[] }> = {}
 for (const se of (weekSessions ?? []) as any[]) {
  const cfaId = se.mission?.cfa?.id ?? se.cfa?.id ?? 'unknown'
  const cfaName = se.mission?.cfa?.name ?? se.cfa?.name ?? 'Sans CFA'
  if (!sessionsByCfa[cfaId]) sessionsByCfa[cfaId] = { cfaName, sessions: [] }
  sessionsByCfa[cfaId].sessions.push(se)
 }
 for (const se of projectedTemplates) {
  const cfaId = se.cfa?.id ?? se.cfa_id ?? 'unknown'
  const cfaName = se.cfa?.name ?? 'Sans CFA'
  if (!sessionsByCfa[cfaId]) sessionsByCfa[cfaId] = { cfaName, sessions: [] }
  sessionsByCfa[cfaId].sessions.push(se)
 }
 for (const g of Object.values(sessionsByCfa)) g.sessions.sort((a, b) => (a.session_date + a.start_time).localeCompare(b.session_date + b.start_time))
 const weekDaysLabels = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']

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
 <div className="field mb-0 flex-1 min-w-[180px]">
 <label className="text-[11px] font-semibold text-navy">CFA</label>
 <select name="cfa" defaultValue={cfaFilter ?? ''} className="text-sm border rounded px-2 py-1 w-full">
 <option value="">Tous les CFA</option>
 {(cfas ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
 </select>
 </div>
 <div className="field mb-0 flex-1 min-w-[180px]">
 <label className="text-[11px] font-semibold text-navy">Formateur</label>
 <select name="trainer" defaultValue={trainerFilter ?? ''} className="text-sm border rounded px-2 py-1 w-full">
 <option value="">Tous les formateurs</option>
 {(trainersList ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
 </select>
 </div>
 <button className="btn btn-sm btn-primary">Appliquer</button>
 <Link href="/dashboard" className="btn btn-sm btn-outline">Réinitialiser</Link>
 </form>

 {((pendingCount ?? 0) > 0 || (absCount ?? 0) > 0 || (subCount ?? 0) > 0) && (
 <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-md mb-5 text-sm flex flex-wrap gap-3 items-center">
 <span></span>
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

 {/* Planning de la semaine par CFA */}
 <div className="card mb-5">
 <div className="card-header">
 <div>
 <div className="card-title">Planning de la semaine ({fmtDate(weekFromStr)} → {fmtDate(weekToStr)})</div>
 <div className="text-xs text-gray-500 mt-0.5">Groupé par CFA. Les séances sans formateur affecté apparaissent en rouge.</div>
 </div>
 </div>
 <div className="card-body space-y-4">
 {Object.keys(sessionsByCfa).length === 0 ? (
 <div className="text-center text-gray-500 py-6 text-sm">Aucune séance planifiée cette semaine.</div>
 ) : (
 Object.values(sessionsByCfa).map(group => (
 <div key={group.cfaName} className="border border-gray-200 rounded-md">
 <div className="bg-brand-light px-3 py-2 font-semibold text-navy text-sm">{group.cfaName} — {group.sessions.length} séance(s)</div>
 <table className="w-full text-xs">
 <thead>
 <tr><th>Jour</th><th>Date</th><th>Horaires</th><th>Formation</th><th>Mission</th><th>Formateur</th><th>Salle</th></tr>
 </thead>
 <tbody>
 {group.sessions.map((se: any, i: number) => {
 const d = new Date(se.session_date)
 const dayIdx = (d.getDay() + 6) % 7
 const noTrainer = !se.trainer_id
 const isTemplate = se._isTemplate
 return (
 <tr key={se.id ?? `tpl-${i}`} className={noTrainer ? 'bg-red-50' : (isTemplate ? 'bg-blue-50/40' : '')}>
 <td className="font-semibold">{weekDaysLabels[dayIdx]}</td>
 <td>{fmtDate(se.session_date)}</td>
 <td>{se.start_time?.slice(0,5)}-{se.end_time?.slice(0,5)}</td>
 <td>{se.mission?.formation?.code ?? se.formation?.code ?? '—'}</td>
 <td className="truncate max-w-[180px]">{se.mission?.name ?? (isTemplate ? <span className="italic text-blue-700">Récurrent</span> : '—')}</td>
 <td className={noTrainer ? 'text-red-700 font-semibold' : ''}>
 {se.trainer ? `${se.trainer.first_name} ${se.trainer.last_name}` : 'À pourvoir'}
 </td>
 <td>{se.room ?? '—'}</td>
 </tr>
 )
 })}
 </tbody>
 </table>
 </div>
 ))
 )}
 </div>
 </div>

 {/* Détail des saisies validées sur la période (avec bouton Dévalider) */}
 {(() => {
   const vw = searchParams.vw === 'grid' ? 'grid' : 'table'
   const scope = searchParams.scope === 'month' ? 'month' : 'week'
   const baseParams: Record<string, string> = {}
   if (searchParams.from) baseParams.from = searchParams.from
   if (searchParams.to) baseParams.to = searchParams.to
   if (searchParams.cfa) baseParams.cfa = searchParams.cfa
   if (searchParams.trainer) baseParams.trainer = searchParams.trainer
   if (searchParams.preset) baseParams.preset = searchParams.preset
   const qs = (extra: Record<string, string>) => new URLSearchParams({ ...baseParams, ...extra }).toString()

   // Base date pour la navigation grille (semaine ou mois)
   const gridBaseDate = searchParams.view && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.view) ? new Date(searchParams.view) : new Date()

   // En mode mois : on couvre toutes les semaines qui touchent le mois sélectionné
   let gridStart: Date, gridEnd: Date
   if (scope === 'month') {
     const monthStart = new Date(gridBaseDate.getFullYear(), gridBaseDate.getMonth(), 1)
     const monthEnd = new Date(gridBaseDate.getFullYear(), gridBaseDate.getMonth() + 1, 0)
     gridStart = mondayOfWeek(monthStart)
     gridEnd = addDays(mondayOfWeek(monthEnd), 6)
   } else {
     gridStart = mondayOfWeek(gridBaseDate)
     gridEnd = addDays(gridStart, 6)
   }
   const gridEntries = entries.filter((e: any) => {
     const d = e.work_date
     return d >= isoDate(gridStart) && d <= isoDate(gridEnd)
   })
   const trainerIdsInGrid = Array.from(new Set(gridEntries.map((e: any) => e.trainer_id).filter(Boolean)))
   const colorByTrainerDash = buildTrainerColorMap(trainerIdsInGrid)
   const gridItems = gridEntries.map((e: any) => ({
     session_date: e.work_date,
     start_time: (e.session?.start_time ?? e.actual_start ?? '08:00').slice(0, 5),
     end_time: (e.session?.end_time ?? e.actual_end ?? '09:00').slice(0, 5),
     colorKey: e.trainer_id as string | null,
     line2: `${e.trainer?.first_name ?? ''} ${e.trainer?.last_name ?? ''}`.trim() || 'Formateur',
     line3: e.session?.mission?.name ?? e.session?.mission?.cfa?.name ?? e.session?.cfa?.name ?? 'Hors mission',
     line4: `${fmtHours(Number(e.hours_actual ?? 0))}`,
     href: `/entries/${e.id}`,
     title: `Cliquer pour voir / modifier / dévalider — ${fmtHours(Number(e.hours_actual ?? 0))}`,
   }))

   // Liste des lundis pour couvrir la plage (1 en mode semaine, 4-6 en mode mois)
   const mondays: Date[] = []
   for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 7)) {
     mondays.push(new Date(d))
   }

   const navStep = scope === 'month' ? 30 : 7
   const prevGridLink = `/dashboard?${qs({ vw: 'grid', scope, view: isoDate(addDays(gridBaseDate, -navStep)) })}`
   const nextGridLink = `/dashboard?${qs({ vw: 'grid', scope, view: isoDate(addDays(gridBaseDate, navStep)) })}`
   const todayGridLink = `/dashboard?${qs({ vw: 'grid', scope })}`

   const monthLabel = gridBaseDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
   const totalGridHours = gridEntries.reduce((a: number, e: any) => a + Number(e.hours_actual ?? 0), 0)

   return (
 <div className="card mb-5">
 <div className="card-header flex-wrap gap-2">
 <div className="card-title flex-1">Saisies validées sur la période</div>
 <div className="flex gap-1 items-center">
   <span className="text-[11px] text-gray-500 uppercase font-semibold mr-1">Affichage</span>
   <Link href={`/dashboard?${qs({ vw: 'table' })}`} className={`btn btn-sm ${vw === 'table' ? 'btn-primary' : 'btn-outline'}`}>Tableau</Link>
   <Link href={`/dashboard?${qs({ vw: 'grid', scope: 'week' })}`} className={`btn btn-sm ${vw === 'grid' && scope === 'week' ? 'btn-primary' : 'btn-outline'}`}>Grille (semaine)</Link>
   <Link href={`/dashboard?${qs({ vw: 'grid', scope: 'month' })}`} className={`btn btn-sm ${vw === 'grid' && scope === 'month' ? 'btn-primary' : 'btn-outline'}`}>Grille (mois)</Link>
 </div>
 </div>
 <div className="card-body p-0">
 {vw === 'grid' ? (
  <div className="p-3">
   <div className="flex items-center gap-2 mb-3 text-sm">
    <Link href={prevGridLink} className="btn btn-sm btn-outline">← {scope === 'month' ? 'Mois' : 'Semaine'} préc.</Link>
    <Link href={todayGridLink} className="btn btn-sm btn-outline">Aujourd'hui</Link>
    <Link href={nextGridLink} className="btn btn-sm btn-outline">{scope === 'month' ? 'Mois' : 'Semaine'} suiv. →</Link>
    <span className="ml-auto text-xs text-gray-600">
     {scope === 'month' ? <>Mois : <b className="capitalize">{monthLabel}</b></> : <>Semaine du <b>{fmtDate(isoDate(gridStart))}</b> au <b>{fmtDate(isoDate(gridEnd))}</b></>}
     {' '}— {gridEntries.length} saisie(s) · <b>{fmtHours(totalGridHours)}</b>
    </span>
   </div>
   <div className="bg-blue-50 border-l-4 border-blue-500 p-2 rounded mb-3 text-[11px] text-blue-900">
    💡 <b>Cliquez sur un bloc</b> pour ouvrir la fiche saisie (modifier les heures, voir la mission, dévalider).
   </div>
   {trainerIdsInGrid.length > 0 && (
    <div className="flex flex-wrap gap-1 mb-3 text-[10px]">
     {trainerIdsInGrid.map(tid => {
      const e = gridEntries.find((x: any) => x.trainer_id === tid)
      const c = colorByTrainerDash[tid as string] ?? NO_TRAINER_COLOR
      return (
       <span key={tid as string} className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium"
        style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
        <span className="w-2 h-2 rounded-full" style={{ background: c.border }} />
        {e?.trainer?.first_name} {e?.trainer?.last_name}
       </span>
      )
     })}
    </div>
   )}
   {gridEntries.length === 0 ? (
    <div className="text-center text-gray-500 py-6 text-sm">Aucune saisie validée sur cette {scope === 'month' ? 'période' : 'semaine'}.</div>
   ) : (
    <div className="space-y-4">
     {mondays.map((m) => {
      const sun = addDays(m, 6)
      const weekItems = gridItems.filter(it => it.session_date >= isoDate(m) && it.session_date <= isoDate(sun))
      if (scope === 'month' && weekItems.length === 0) return null
      return (
       <div key={isoDate(m)}>
        {scope === 'month' && (
         <div className="text-xs font-semibold text-navy mb-1">
          Semaine du {fmtDate(isoDate(m))} au {fmtDate(isoDate(sun))} ({weekItems.length} saisie(s))
         </div>
        )}
        <WeekGrid
         monday={m}
         items={weekItems}
         colorByKey={colorByTrainerDash as any}
         unassignedColor={NO_TRAINER_COLOR}
        />
       </div>
      )
     })}
    </div>
   )}
  </div>
 ) : (
 <table className="w-full">
 <thead><tr><th>Date</th><th>Formateur</th><th>Mission / CFA</th><th>Heures</th><th></th></tr></thead>
 <tbody>
 {entries.slice(0, 50).map((e: any) => {
 const cfaName = e.session?.mission?.cfa?.name ?? e.session?.cfa?.name ?? '—'
 const missionName = e.session?.mission?.name
 const missionId = e.session?.mission_id
 return (
 <tr key={e.id}>
 <td className="text-xs">{fmtDate(e.work_date)}</td>
 <td className="text-xs">{e.trainer?.first_name} {e.trainer?.last_name}</td>
 <td className="text-xs">
 <div>
 {missionName && missionId
 ? <Link href={`/missions/${missionId}`} className="text-brand font-semibold hover:underline" title="Ouvrir la fiche mission">{missionName}</Link>
 : <Link href={`/entries/${e.id}`} className="italic text-amber-700 hover:underline" title="Voir le détail de cette saisie hors mission">Hors mission →</Link>}
 </div>
 <div className="text-gray-500">{cfaName}</div>
 </td>
 <td>{fmtHours(Number(e.hours_actual ?? 0))}</td>
 <td>
 <div className="flex gap-1 flex-wrap">
 <Link href={`/entries/${e.id}`} className="btn btn-sm btn-outline" title="Voir le détail de la saisie et la modifier">Voir saisie</Link>
 {missionId && (
 <Link href={`/missions/${missionId}`} className="btn btn-sm btn-outline" title="Voir la fiche mission">Voir mission</Link>
 )}
 <form action={unvalidateEntry}>
 <input type="hidden" name="entry_id" value={e.id} />
 <button className="btn btn-sm btn-outline" title="Remettre cette saisie en attente de validation">↺ Dévalider</button>
 </form>
 </div>
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
 )}
 </div>
 </div>
   )
 })()}

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <QuickLink href="/missions/new" title="+ Créer une mission" desc="Assistant avec planning récurrent" />
 <QuickLink href="/validation" title=" Valider des heures" desc="File des saisies en attente" />
 <QuickLink href="/pedagogy" title=" Suivi pédagogique" desc="Export au format CFP" />
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
