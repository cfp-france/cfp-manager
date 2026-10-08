'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createMissionWithRecurrence(formData: FormData) {
  const s = createClient()
  const p: any = Object.fromEntries(formData)
  const weekdays = formData.getAll('weekdays').map((v) => Number(v))

  // 1. Créer la mission
  const { data: mission, error: err1 } = await s.from('missions').insert({
    name: p.name,
    cfa_id: p.cfa_id,
    formation_id: p.formation_id || null,
    start_date: p.start_date,
    end_date: p.end_date,
    default_room: p.default_room || null,
    cfa_hourly_rate: Number(p.cfa_hourly_rate),
    trainer_hourly_rate: Number(p.trainer_hourly_rate),
  }).select('id').single()
  if (err1 || !mission) { console.error(err1); return }

  // 2. Créer la règle de récurrence
  const exceptions: string[] = p.exceptions ? String(p.exceptions).split(',').map((x: string) => x.trim()).filter(Boolean) : []
  await s.from('session_recurrences').insert({
    mission_id: mission.id,
    weekdays,
    start_time: p.start_time,
    end_time: p.end_time,
    break_minutes: Number(p.break_minutes ?? 60),
    start_date: p.start_date,
    end_date: p.end_date,
    exceptions,
    default_room: p.default_room || null,
    default_trainer_id: p.default_trainer_id || null,
  })

  // 3. Générer les séances
  const sessions: any[] = []
  const start = new Date(p.start_date)
  const end = new Date(p.end_date)
  const excSet = new Set(exceptions)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay() // 0 = dim, 1 = lun … (Postgres extract dow = 0..6)
    if (!weekdays.includes(dow)) continue
    const iso = d.toISOString().slice(0, 10)
    if (excSet.has(iso)) continue
    sessions.push({
      mission_id: mission.id,
      session_date: iso,
      start_time: p.start_time,
      end_time: p.end_time,
      break_minutes: Number(p.break_minutes ?? 60),
      room: p.default_room || null,
      trainer_id: p.default_trainer_id || null,
    })
  }
  if (sessions.length > 0) await s.from('mission_sessions').insert(sessions)

  revalidatePath('/missions')
  redirect('/missions')
}

/**
 * Édition d'une mission existante par l'admin (nom, CFA, formation, période, tarifs, salle).
 * Permet notamment de corriger le CFA si le formateur l'a mal sélectionné.
 * Si `apply_to_sessions` est coché, met également à jour les séances/time_entries déjà rattachées
 * (utile quand on change le CFA pour que la facturation CFA pointe au bon endroit).
 */
export async function updateMission(formData: FormData) {
  const s = createClient()
  const p: any = Object.fromEntries(formData)
  const id = p.id
  if (!id) return

  // 1. Récupérer l'ancien état pour comparer le CFA
  const { data: current } = await s.from('missions').select('cfa_id').eq('id', id).single()

  // 2. Mettre à jour la mission
  const { error } = await s.from('missions').update({
    name: p.name,
    cfa_id: p.cfa_id,
    formation_id: p.formation_id || null,
    start_date: p.start_date,
    end_date: p.end_date,
    default_room: p.default_room || null,
    cfa_hourly_rate: Number(p.cfa_hourly_rate),
    trainer_hourly_rate: Number(p.trainer_hourly_rate),
    description: p.description || null,
  }).eq('id', id)
  if (error) { console.error('[updateMission]', error); return }

  // 3. Si le CFA a changé ET que l'admin a demandé la propagation,
  //    reporter le changement sur toutes les séances rattachées à la mission.
  if (current && current.cfa_id !== p.cfa_id && p.apply_to_sessions === '1') {
    await s.from('mission_sessions').update({ cfa_id: p.cfa_id }).eq('mission_id', id)
  }

  revalidatePath('/missions')
  revalidatePath(`/missions/${id}`)
  redirect(`/missions/${id}`)
}

export async function archiveMission(formData: FormData) {
  const s = createClient()
  const id = formData.get('id') as string
  if (!id) return
  await s.from('missions').update({ archived_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/missions')
  redirect('/missions')
}

export async function unarchiveMission(formData: FormData) {
  const s = createClient()
  const id = formData.get('id') as string
  if (!id) return
  await s.from('missions').update({ archived_at: null }).eq('id', id)
  revalidatePath('/missions')
  redirect(`/missions/${id}`)
}
