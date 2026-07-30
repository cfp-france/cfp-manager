import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtHours } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function PedagogyPage({ searchParams }: { searchParams: Record<string, string> }) {
  const s = createClient()

  const [{ data: formations }, { data: cfas }, { data: trainers }] = await Promise.all([
    s.from('formations').select('id, code, name').order('code'),
    s.from('cfa').select('id, name').order('name'),
    s.from('trainers').select('id, first_name, last_name').order('last_name'),
  ])

  // Filtres depuis URL
  const q_formation = searchParams.formation
  const q_cfa = searchParams.cfa
  const q_trainer = searchParams.trainer
  const q_block = searchParams.block
  const q_from = searchParams.from
  const q_to = searchParams.to

  let qb = s.from('time_entries')
    .select(`*, trainer:trainers(first_name, last_name),
      session:mission_sessions(start_time, end_time,
        mission:missions(name, formation_id, cfa_id, cfa:cfa(name), formations(code)))`)
    .eq('status', 'validated').order('work_date', { ascending: true })

  if (q_from) qb = qb.gte('work_date', q_from)
  if (q_to) qb = qb.lte('work_date', q_to)
  if (q_trainer) qb = qb.eq('trainer_id', q_trainer)
  if (q_block) qb = qb.contains('competence_blocks_targeted', [Number(q_block)])

  let { data: rows } = await qb
  if (q_formation) rows = (rows ?? []).filter((r: any) => r.session?.mission?.formation_id === q_formation)
  if (q_cfa) rows = (rows ?? []).filter((r: any) => r.session?.mission?.cfa_id === q_cfa)

  // Récupérer les libellés de compétences pour l'affichage
  const allSkillIds = [...new Set((rows ?? []).flatMap((r: any) => r.skill_ids ?? []))]
  const { data: skills } = allSkillIds.length ? await s.from('skills').select('id, label').in('id', allSkillIds) : { data: [] }
  const skillMap = new Map((skills ?? []).map((sk: any) => [sk.id, sk.label]))

  const exportUrl = `/api/export/pedagogy?${new URLSearchParams(searchParams).toString()}`

  return (
    <div>
      <PageHeader title="Suivi pédagogique" subtitle={`${rows?.length ?? 0} séances validées correspondant aux filtres`}
        actions={<a href={exportUrl} className="btn btn-primary">📊 Exporter en CSV (format CFP)</a>} />

      <form className="card mb-6">
        <div className="card-header"><div className="card-title">🔎 Filtres</div>
          <div className="text-xs text-gray-500">Les filtres s'appliquent à l'affichage et à l'export.</div>
        </div>
        <div className="card-body grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="field"><label>Formation</label>
            <select name="formation" defaultValue={q_formation ?? ''}><option value="">Toutes</option>
              {formations?.map(f => <option key={f.id} value={f.id}>{f.code}</option>)}</select></div>
          <div className="field"><label>CFA</label>
            <select name="cfa" defaultValue={q_cfa ?? ''}><option value="">Tous</option>
              {cfas?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="field"><label>Formateur</label>
            <select name="trainer" defaultValue={q_trainer ?? ''}><option value="">Tous</option>
              {trainers?.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}</select></div>
          <div className="field"><label>Bloc</label>
            <select name="block" defaultValue={q_block ?? ''}><option value="">Tous</option><option value="1">Bloc 1</option><option value="2">Bloc 2</option></select></div>
          <div className="field"><label>Du</label><input type="date" name="from" defaultValue={q_from ?? ''} /></div>
          <div className="field"><label>Au</label><input type="date" name="to" defaultValue={q_to ?? ''} /></div>
          <div className="field md:col-span-2 flex items-end"><button className="btn btn-primary w-full">Appliquer</button></div>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead><tr>
            <th>Date et heure</th><th>Formateur</th><th>Bloc</th>
            <th>Compétence(s) visée(s)</th><th>Contenu abordé</th>
            <th>Supports</th><th>Travail effectué</th><th>Commentaire</th>
          </tr></thead>
          <tbody>
            {rows?.map((r: any) => (
              <tr key={r.id} className="align-top">
                <td className="whitespace-nowrap"><b>{fmtDate(r.work_date)}</b><br/><span className="text-[11px] text-gray-500">{fmtHours(Number(r.hours_actual))}</span></td>
                <td>{r.trainer?.first_name} {r.trainer?.last_name}</td>
                <td className="text-center">{(r.competence_blocks_targeted ?? []).join(' + ') || '—'}</td>
                <td className="text-xs">{(r.skill_ids ?? []).map((id: string) => skillMap.get(id)).filter(Boolean).join(' · ') || '—'}</td>
                <td className="text-xs">{r.content_covered || '—'}</td>
                <td className="text-xs">{r.pedagogical_supports || '—'}</td>
                <td className="text-xs">{r.work_done || '—'}</td>
                <td className="text-xs bg-amber-50/50">{r.points_to_review || '—'}</td>
              </tr>
            ))}
            {(!rows || rows.length === 0) && <tr><td colSpan={8} className="text-center text-gray-500 py-8">Aucune séance validée ne correspond aux filtres.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
