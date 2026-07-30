import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const s = createClient()
  const url = new URL(req.url)
  const q_formation = url.searchParams.get('formation')
  const q_cfa = url.searchParams.get('cfa')
  const q_trainer = url.searchParams.get('trainer')
  const q_block = url.searchParams.get('block')
  const q_from = url.searchParams.get('from')
  const q_to = url.searchParams.get('to')

  let qb = s.from('time_entries')
    .select(`*, trainer:trainers(first_name, last_name),
      session:mission_sessions(mission:missions(name, formation_id, cfa_id, cfa:cfa(name)))`)
    .eq('status', 'validated').order('work_date', { ascending: true })

  if (q_from) qb = qb.gte('work_date', q_from)
  if (q_to) qb = qb.lte('work_date', q_to)
  if (q_trainer) qb = qb.eq('trainer_id', q_trainer)
  if (q_block) qb = qb.contains('competence_blocks_targeted', [Number(q_block)])

  let { data: rows } = await qb
  if (q_formation) rows = (rows ?? []).filter((r: any) => r.session?.mission?.formation_id === q_formation)
  if (q_cfa) rows = (rows ?? []).filter((r: any) => r.session?.mission?.cfa_id === q_cfa)

  const allSkillIds = [...new Set((rows ?? []).flatMap((r: any) => r.skill_ids ?? []))]
  const { data: skills } = allSkillIds.length ? await s.from('skills').select('id, label').in('id', allSkillIds) : { data: [] }
  const skillMap = new Map((skills ?? []).map((sk: any) => [sk.id, sk.label]))

  // Format CSV (délimiteur ; pour Excel FR)
  const headers = ['Date et heure', 'Formateur', 'Bloc (1 ou 2)', 'Compétence(s) visée(s)', 'Contenu abordé', 'Supports pédagogiques utilisés', 'Travail effectué / Avancement', 'Commentaire / Points à revoir']
  const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`

  const lines = [headers.join(';')]
  for (const r of rows ?? []) {
    const dateStr = new Date(r.work_date).toLocaleDateString('fr-FR')
    const hh = Math.floor(Number(r.hours_actual))
    const mm = Math.round((Number(r.hours_actual) - hh) * 60)
    const dateHours = `${dateStr} ${hh}H${mm.toString().padStart(2, '0')}`
    const trainer = `${r.trainer?.first_name ?? ''} ${r.trainer?.last_name ?? ''}`.trim()
    const bloc = (r.competence_blocks_targeted ?? []).join(' + ') || ''
    const comps = (r.skill_ids ?? []).map((id: string) => skillMap.get(id)).filter(Boolean).join(' | ')
    lines.push([dateHours, trainer, bloc, comps, r.content_covered, r.pedagogical_supports, r.work_done, r.points_to_review].map(escape).join(';'))
  }

  const csv = '﻿' + lines.join('\n')  // BOM UTF-8 pour Excel
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="suivi_deroule_pedagogique_${new Date().toISOString().slice(0,10)}.csv"`,
    },
  })
}
