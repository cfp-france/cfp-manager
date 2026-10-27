import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtHours, requireTrainer } from '@/lib/utils'
import { WeekGrid, mondayOfWeek, isoDate, addDays } from '@/components/WeekGrid'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// Même palette que /mon-planning pour cohérence formateur
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
const NEUTRAL = { bg: '#f3f4f6', border: '#9ca3af', text: '#374151' }

export default async function TrainerSessionsPage({ searchParams }: { searchParams: { declared?: string; vw?: string; w?: string; scope?: string; status?: string } }) {
 const { trainer } = await requireTrainer()
 const s = createClient()
 const { data: allSessions } = await s.from('mission_sessions')
 .select(`*, mission:missions(name, cfa:cfa(id, name)), cfa:cfa(id, name), time_entries(id, status, hours_actual, actual_start, actual_end, admin_comment, validated_at)`)
 .eq('trainer_id', trainer?.id ?? '00000000-0000-0000-0000-000000000000')
 .order('session_date', { ascending: false })

 // Compteurs de statut (sur toutes les séances du formateur)
 const counts = { total: 0, aSaisir: 0, draft: 0, submitted: 0, validated: 0, refused: 0 }
 for (const se of (allSessions ?? []) as any[]) {
  counts.total++
  const te = Array.isArray(se.time_entries) ? se.time_entries[0] : se.time_entries
  if (!te) counts.aSaisir++
  else if (te.status === 'draft') counts.draft++
  else if (te.status === 'submitted') counts.submitted++
  else if (te.status === 'validated') counts.validated++
  else if (te.status === 'refused') counts.refused++
 }

 const statusFilter = searchParams.status || ''
 const sessions = (allSessions ?? []).filter((se: any) => {
  if (!statusFilter) return true
  const te = Array.isArray(se.time_entries) ? se.time_entries[0] : se.time_entries
  if (statusFilter === 'to_fill') return !te
  if (statusFilter === 'draft') return te?.status === 'draft'
  if (statusFilter === 'submitted') return te?.status === 'submitted'
  if (statusFilter === 'validated') return te?.status === 'validated'
  if (statusFilter === 'refused') return te?.status === 'refused'
  return true
 })

 const vw = searchParams.vw === 'grid' ? 'grid' : 'table'
 const scope = searchParams.scope === 'month' ? 'month' : 'week'

 // Mode grille : semaine ou mois
 const gridBase = searchParams.w && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.w) ? new Date(searchParams.w) : new Date()
 let gridStart: Date, gridEnd: Date
 if (scope === 'month') {
  const mStart = new Date(gridBase.getFullYear(), gridBase.getMonth(), 1)
  const mEnd = new Date(gridBase.getFullYear(), gridBase.getMonth() + 1, 0)
  gridStart = mondayOfWeek(mStart)
  gridEnd = addDays(mondayOfWeek(mEnd), 6)
 } else {
  gridStart = mondayOfWeek(gridBase)
  gridEnd = addDays(gridStart, 6)
 }
 const gridSessions = (sessions ?? []).filter((se: any) =>
  se.session_date >= isoDate(gridStart) && se.session_date <= isoDate(gridEnd))

 const cfaIds = Array.from(new Set(gridSessions.map((se: any) => se.mission?.cfa?.id ?? se.cfa?.id).filter(Boolean)))
 const colorByCfa: Record<string, { bg: string; border: string; text: string }> = {}
 cfaIds.sort().forEach((id, i) => { colorByCfa[id as string] = CFA_PALETTE[i % CFA_PALETTE.length] })

 const gridItems = gridSessions.map((se: any) => {
  const teRaw = se.time_entries
  const teArr = Array.isArray(teRaw) ? teRaw : (teRaw ? [teRaw] : [])
  const te = teArr[0]
  const statusLabel = !te ? 'À saisir'
   : te.status === 'draft' ? 'Brouillon'
   : te.status === 'submitted' ? 'Soumise'
   : te.status === 'validated' ? `Validée · ${fmtHours(Number(te.hours_actual ?? 0))}`
   : te.status === 'refused' ? 'Refusée' : ''
  const cfa = se.mission?.cfa ?? se.cfa
  return {
   session_date: se.session_date,
   start_time: (se.start_time ?? '08:00').slice(0, 5),
   end_time: (se.end_time ?? '09:00').slice(0, 5),
   colorKey: cfa?.id as string | null,
   line2: cfa?.name ?? 'CFA',
   line3: se.mission?.name ?? (se.self_declared ? 'Hors planning' : '—'),
   line4: statusLabel,
   href: `/sessions/${se.id}`,
   title: `Cliquer pour saisir/modifier (${statusLabel})`,
  }
 })

 const mondays: Date[] = []
 for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 7)) mondays.push(new Date(d))

 const navStep = scope === 'month' ? 30 : 7
 const prevW = isoDate(addDays(gridBase, -navStep))
 const nextW = isoDate(addDays(gridBase, navStep))
 const monthLabel = gridBase.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
 const totalHours = gridSessions.reduce((a: number, se: any) => {
  const teRaw = se.time_entries
  const teArr = Array.isArray(teRaw) ? teRaw : (teRaw ? [teRaw] : [])
  return a + Number(teArr[0]?.hours_actual ?? 0)
 }, 0)
 const totalValidatedHours = gridSessions.reduce((a: number, se: any) => {
  const teRaw = se.time_entries
  const teArr = Array.isArray(teRaw) ? teRaw : (teRaw ? [teRaw] : [])
  const te = teArr[0]
  return a + (te?.status === 'validated' ? Number(te.hours_actual ?? 0) : 0)
 }, 0)

 return (
 <div>
 <PageHeader
 title="Mes séances"
 subtitle={`${sessions?.length ?? 0} séances au total`}
 actions={<Link href="/declare-session" className="btn btn-primary">+ Déclarer une séance</Link>}
 />

 {searchParams.declared === '1' && (
 <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded mb-4 text-sm">
 Votre séance a été déclarée et envoyée à l'administration pour validation.
 </div>
 )}

 {/* Récap des statuts de saisies */}
 <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
  <StatusCard label="À saisir" count={counts.aSaisir} color="gray"
   href={`/sessions${statusFilter === 'to_fill' ? '' : '?status=to_fill'}`} active={statusFilter === 'to_fill'} />
  <StatusCard label="Brouillons" count={counts.draft} color="gray"
   href={`/sessions${statusFilter === 'draft' ? '' : '?status=draft'}`} active={statusFilter === 'draft'} />
  <StatusCard label="⏳ Soumises (en attente)" count={counts.submitted} color="amber"
   href={`/sessions${statusFilter === 'submitted' ? '' : '?status=submitted'}`} active={statusFilter === 'submitted'} />
  <StatusCard label="✓ Validées" count={counts.validated} color="green"
   href={`/sessions${statusFilter === 'validated' ? '' : '?status=validated'}`} active={statusFilter === 'validated'} />
  <StatusCard label="✗ Refusées" count={counts.refused} color="red"
   href={`/sessions${statusFilter === 'refused' ? '' : '?status=refused'}`} active={statusFilter === 'refused'} />
 </div>

 {statusFilter && (
  <div className="mb-3 text-sm">
   Filtre actif : <b>{statusFilter === 'to_fill' ? 'À saisir' : statusFilter === 'draft' ? 'Brouillons' : statusFilter === 'submitted' ? 'Soumises' : statusFilter === 'validated' ? 'Validées' : 'Refusées'}</b>
   <Link href="/sessions" className="ml-2 btn btn-sm btn-outline">Tout afficher</Link>
  </div>
 )}

 <div className="flex items-center gap-2 mb-3">
  <span className="text-[11px] text-gray-500 uppercase font-semibold">Affichage</span>
  <Link href={`/sessions?vw=table${statusFilter ? `&status=${statusFilter}` : ''}`} className={`btn btn-sm ${vw === 'table' ? 'btn-primary' : 'btn-outline'}`}>Tableau</Link>
  <Link href={`/sessions?vw=grid&scope=week${statusFilter ? `&status=${statusFilter}` : ''}`} className={`btn btn-sm ${vw === 'grid' && scope === 'week' ? 'btn-primary' : 'btn-outline'}`}>Grille (semaine)</Link>
  <Link href={`/sessions?vw=grid&scope=month${statusFilter ? `&status=${statusFilter}` : ''}`} className={`btn btn-sm ${vw === 'grid' && scope === 'month' ? 'btn-primary' : 'btn-outline'}`}>Grille (mois)</Link>
 </div>

 {vw === 'grid' ? (
  <>
   <div className="flex items-center gap-2 mb-3 text-sm flex-wrap">
    <Link href={`/sessions?vw=grid&scope=${scope}&w=${prevW}`} className="btn btn-sm btn-outline">← {scope === 'month' ? 'Mois' : 'Semaine'} préc.</Link>
    <Link href={`/sessions?vw=grid&scope=${scope}`} className="btn btn-sm btn-outline">Aujourd'hui</Link>
    <Link href={`/sessions?vw=grid&scope=${scope}&w=${nextW}`} className="btn btn-sm btn-outline">{scope === 'month' ? 'Mois' : 'Semaine'} suiv. →</Link>
    <span className="ml-auto text-xs text-gray-600">
     {scope === 'month' ? <>Mois : <b className="capitalize">{monthLabel}</b></> : <>Du <b>{fmtDate(isoDate(gridStart))}</b> au <b>{fmtDate(isoDate(gridEnd))}</b></>}
     {' '}— {gridSessions.length} séance(s) · <b>{fmtHours(totalValidatedHours)}</b> validées sur {fmtHours(totalHours)}
    </span>
   </div>
   <div className="bg-blue-50 border-l-4 border-blue-500 p-2 rounded mb-3 text-[11px] text-blue-900">
    💡 <b>Cliquez sur un bloc</b> pour saisir ou modifier la séance. Utile pour contrôler vos heures sur le mois complet.
   </div>
   {cfaIds.length > 0 && (
    <div className="flex flex-wrap gap-1 mb-3 text-[10px]">
     {cfaIds.map(id => {
      const c = colorByCfa[id as string]
      const name = gridSessions.find((se: any) => (se.mission?.cfa?.id ?? se.cfa?.id) === id)?.mission?.cfa?.name
       ?? gridSessions.find((se: any) => (se.cfa?.id) === id)?.cfa?.name ?? '—'
      return (
       <span key={id as string} className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium"
        style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
        <span className="w-2 h-2 rounded-full" style={{ background: c.border }} />
        {name}
       </span>
      )
     })}
    </div>
   )}
   {gridSessions.length === 0 ? (
    <div className="card p-8 text-center text-gray-500">Aucune séance sur cette {scope === 'month' ? 'période' : 'semaine'}. Naviguez avec ← →.</div>
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
          Semaine du {fmtDate(isoDate(m))} au {fmtDate(isoDate(sun))} ({weekItems.length} séance(s))
         </div>
        )}
        <WeekGrid monday={m} items={weekItems} colorByKey={colorByCfa} unassignedColor={NEUTRAL} />
       </div>
      )
     })}
    </div>
   )}
  </>
 ) : (
 <div className="card">
 <table className="w-full">
 <thead><tr><th>Date</th><th>Mission / CFA</th><th>Horaires</th><th>Prévu</th><th>Statut saisie</th><th>Action</th></tr></thead>
 <tbody>
 {sessions?.map((se: any) => {
 const te = se.time_entries?.[0]
 const isSelfDeclared = se.self_declared === true
 const cfaName = se.mission?.cfa?.name ?? se.cfa?.name ?? '—'
 return (
 <tr key={se.id}>
 <td className="font-semibold">
 {fmtDate(se.session_date)}
 {isSelfDeclared && <div className="text-[10px] text-amber-700 font-semibold mt-0.5"> Déclarée</div>}
 </td>
 <td>
 <div>{se.mission?.name ?? <span className="text-gray-400 italic">Hors planning</span>}</div>
 <div className="text-xs text-gray-500">{cfaName}</div>
 </td>
 <td>{se.start_time?.slice(0,5)}-{se.end_time?.slice(0,5)}</td>
 <td>{fmtHours(Number(se.hours_planned))}</td>
 <td>
 {!te && <span className="inline-block px-2 py-1 rounded text-[11px] font-semibold bg-gray-100 text-gray-700">À saisir</span>}
 {te?.status === 'draft' && <span className="inline-block px-2 py-1 rounded text-[11px] font-semibold bg-gray-100 text-gray-700">📝 Brouillon</span>}
 {te?.status === 'submitted' && (
  <div>
   <span className="inline-block px-2 py-1 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">⏳ Soumise</span>
   <div className="text-[10px] text-gray-500 mt-0.5">en attente admin</div>
  </div>
 )}
 {te?.status === 'validated' && (
  <div>
   <span className="inline-block px-2 py-1 rounded text-[11px] font-semibold bg-green-100 text-green-800">✓ Validée</span>
   <div className="text-[10px] text-gray-500 mt-0.5">{fmtHours(Number(te.hours_actual))}</div>
  </div>
 )}
 {te?.status === 'refused' && (
  <div>
   <span className="inline-block px-2 py-1 rounded text-[11px] font-semibold bg-red-100 text-red-800">✗ Refusée</span>
   {te.admin_comment && <div className="text-[10px] text-red-700 mt-0.5 italic">Motif : {te.admin_comment}</div>}
  </div>
 )}
 </td>
 <td><Link href={`/sessions/${se.id}`} className="btn btn-sm btn-outline">{!te ? 'Saisir' : te.status === 'validated' ? 'Voir' : 'Voir / Modifier'}</Link></td>
 </tr>
 )
 })}
 {(!sessions || sessions.length === 0) && <tr><td colSpan={6} className="text-center text-gray-500 py-8">Aucune séance. Cliquez sur « + Déclarer une séance » si vous avez fait une intervention hors planning.</td></tr>}
 </tbody>
 </table>
 </div>
 )}
 </div>
 )
}

function StatusCard({ label, count, color, href, active }: { label: string; count: number; color: 'gray' | 'amber' | 'green' | 'red'; href: string; active: boolean }) {
 const colors = {
  gray: 'bg-gray-50 border-gray-300 text-gray-700',
  amber: 'bg-amber-50 border-amber-500 text-amber-800',
  green: 'bg-green-50 border-green-500 text-green-800',
  red: 'bg-red-50 border-red-500 text-red-800',
 }
 return (
  <Link href={href} className={`card p-3 border-l-4 ${colors[color]} ${active ? 'ring-2 ring-offset-1 ring-navy' : 'hover:ring-1 hover:ring-navy'}`}>
   <div className="text-[11px] font-semibold uppercase tracking-wider">{label}</div>
   <div className="text-2xl font-bold mt-1">{count}</div>
  </Link>
 )
}
