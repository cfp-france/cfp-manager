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

export default async function TrainerSessionsPage({ searchParams }: { searchParams: { declared?: string; vw?: string; w?: string } }) {
 const { trainer } = await requireTrainer()
 const s = createClient()
 const { data: sessions } = await s.from('mission_sessions')
 .select(`*, mission:missions(name, cfa:cfa(id, name)), cfa:cfa(id, name), time_entries(id, status, hours_actual, actual_start, actual_end)`)
 .eq('trainer_id', trainer?.id ?? '00000000-0000-0000-0000-000000000000')
 .order('session_date', { ascending: false })

 const vw = searchParams.vw === 'grid' ? 'grid' : 'table'

 // Mode grille : focus sur une semaine
 const gridBase = searchParams.w && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.w) ? new Date(searchParams.w) : new Date()
 const gridMonday = mondayOfWeek(gridBase)
 const gridSunday = addDays(gridMonday, 6)
 const gridSessions = (sessions ?? []).filter((se: any) =>
  se.session_date >= isoDate(gridMonday) && se.session_date <= isoDate(gridSunday))

 const cfaIds = Array.from(new Set(gridSessions.map((se: any) => se.mission?.cfa?.id ?? se.cfa?.id).filter(Boolean)))
 const colorByCfa: Record<string, { bg: string; border: string; text: string }> = {}
 cfaIds.sort().forEach((id, i) => { colorByCfa[id as string] = CFA_PALETTE[i % CFA_PALETTE.length] })

 const gridItems = gridSessions.map((se: any) => {
  const te = Array.isArray(se.time_entries) ? se.time_entries[0] : null
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
  }
 })
 const prevW = isoDate(addDays(gridMonday, -7))
 const nextW = isoDate(addDays(gridMonday, 7))

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

 <div className="flex items-center gap-2 mb-3">
  <span className="text-[11px] text-gray-500 uppercase font-semibold">Affichage</span>
  <Link href="/sessions?vw=table" className={`btn btn-sm ${vw === 'table' ? 'btn-primary' : 'btn-outline'}`}>Tableau</Link>
  <Link href="/sessions?vw=grid" className={`btn btn-sm ${vw === 'grid' ? 'btn-primary' : 'btn-outline'}`}>Grille horaire</Link>
 </div>

 {vw === 'grid' ? (
  <>
   <div className="flex items-center gap-2 mb-3 text-sm">
    <Link href={`/sessions?vw=grid&w=${prevW}`} className="btn btn-sm btn-outline">← Semaine préc.</Link>
    <Link href="/sessions?vw=grid" className="btn btn-sm btn-outline">Cette semaine</Link>
    <Link href={`/sessions?vw=grid&w=${nextW}`} className="btn btn-sm btn-outline">Semaine suiv. →</Link>
    <span className="ml-auto text-xs text-gray-600">
     Du <b>{fmtDate(isoDate(gridMonday))}</b> au <b>{fmtDate(isoDate(gridSunday))}</b> — {gridSessions.length} séance(s)
    </span>
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
    <div className="card p-8 text-center text-gray-500">Aucune séance cette semaine. Naviguez avec ← →.</div>
   ) : (
    <WeekGrid monday={gridMonday} items={gridItems} colorByKey={colorByCfa} unassignedColor={NEUTRAL} />
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
 {!te && <span className="status status-pending">À saisir</span>}
 {te?.status === 'draft' && <span className="status status-pending">Brouillon</span>}
 {te?.status === 'submitted' && <span className="status status-pending">Soumise</span>}
 {te?.status === 'validated' && <span className="status status-validated">Validée · {fmtHours(Number(te.hours_actual))}</span>}
 {te?.status === 'refused' && <span className="status status-refused">Refusée</span>}
 </td>
 <td><Link href={`/sessions/${se.id}`} className="btn btn-sm btn-outline">{te?.status === 'validated' ? 'Voir' : (te?.status === 'submitted' || te?.status === 'refused' ? 'Voir' : 'Saisir')}</Link></td>
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
