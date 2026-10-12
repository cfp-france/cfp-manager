'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function upsertSlot(formData: FormData) {
  const s = createClient()
  const p = Object.fromEntries(formData) as any
  const cfa_id = p.cfa_id
  const weekday = Number(p.weekday)
  const start_time = p.start_time
  const end_time = p.end_time
  if (!cfa_id || !weekday || !start_time || !end_time) return

  const payload = {
    cfa_id,
    weekday,
    start_time,
    end_time,
    kind: p.kind || 'lesson',
    trainer_id: p.trainer_id || null,
    formation_id: p.formation_id || null,
    block_id: p.block_id || null,
    room: p.room || null,
    label: p.label || null,
    notes: p.notes || null,
    updated_at: new Date().toISOString(),
  }

  if (p.id) {
    await s.from('weekly_schedule_slots').update(payload).eq('id', p.id)
  } else {
    await s.from('weekly_schedule_slots').insert(payload)
  }
  revalidatePath('/weekly-schedule')
  redirect('/weekly-schedule?cfa=' + cfa_id + '&toast=' + encodeURIComponent('Créneau enregistré.'))
}

export async function deleteSlot(formData: FormData) {
  const s = createClient()
  const id = formData.get('id') as string
  const cfa_id = formData.get('cfa_id') as string
  if (!id) return
  await s.from('weekly_schedule_slots').delete().eq('id', id)
  revalidatePath('/weekly-schedule')
  redirect('/weekly-schedule?cfa=' + (cfa_id ?? '') + '&toast=' + encodeURIComponent('Créneau supprimé.') + '&toast_type=info')
}

/**
 * Génère les séances concrètes (mission_sessions) à partir du planning hebdomadaire récurrent
 * d'un CFA, pour la période [start_date, end_date].
 *
 * - Les créneaux de type "pause" et "pause déjeuner" sont ignorés (pas de séance pour ça).
 * - Les créneaux de type "lesson" ou "event" créent une mission_session chacune.
 * - Si une mission existe déjà pour la même (trainer, date, start_time) : on skip (évite les doublons).
 * - L'admin choisit la mission à laquelle rattacher les séances :
 *     - option "existing" : une mission existante du CFA
 *     - option "generic"  : on crée automatiquement une mission "<CFA> — Planning <période>" si pas déjà faite
 */
export async function generateSessionsFromSchedule(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) redirect('/login')

  const cfa_id = formData.get('cfa_id') as string
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string
  const mission_choice = (formData.get('mission_choice') as string) || 'existing'
  const existing_mission_id = (formData.get('mission_id') as string) || null
  const cfa_rate = Number(formData.get('cfa_hourly_rate') ?? 0)
  const trainer_rate = Number(formData.get('trainer_hourly_rate') ?? 0)
  if (!cfa_id || !start_date || !end_date) return

  // 1) Charger le planning hebdo du CFA
  const { data: slots } = await s.from('weekly_schedule_slots')
    .select('*').eq('cfa_id', cfa_id)
    .in('kind', ['lesson', 'event'])
  if (!slots || slots.length === 0) {
    redirect(`/weekly-schedule?cfa=${cfa_id}&toast=` + encodeURIComponent('Aucun créneau de cours dans le planning du CFA.') + '&toast_type=error')
  }

  // 2) Déterminer la mission cible
  let targetMissionId: string | null = null
  if (mission_choice === 'existing' && existing_mission_id) {
    targetMissionId = existing_mission_id
  } else if (mission_choice === 'generic') {
    // Créer / réutiliser une mission générique pour la période
    const { data: cfa } = await s.from('cfa').select('name').eq('id', cfa_id).single()
    const name = `${cfa?.name ?? 'CFA'} — Planning ${start_date} → ${end_date}`
    const { data: existing } = await s.from('missions').select('id').eq('cfa_id', cfa_id).eq('name', name).maybeSingle()
    if (existing?.id) {
      targetMissionId = existing.id
      // Mettre à jour les tarifs si l'admin les a renseignés
      if (cfa_rate > 0 || trainer_rate > 0) {
        await s.from('missions').update({
          cfa_hourly_rate: cfa_rate || 0,
          trainer_hourly_rate: trainer_rate || 0,
        }).eq('id', existing.id)
      }
    } else {
      const { data: created } = await s.from('missions').insert({
        name,
        cfa_id,
        start_date,
        end_date,
        cfa_hourly_rate: cfa_rate || 0,
        trainer_hourly_rate: trainer_rate || 0,
      }).select('id').single()
      targetMissionId = created?.id ?? null
    }
  }
  // Si pas de mission choisie : on laisse mission_id null (séance "hors mission"), avec cfa_id sur la séance

  // 3) Parcourir chaque jour de la période et instancier les créneaux correspondants
  const start = new Date(start_date)
  const end = new Date(end_date)
  const sessionsToInsert: any[] = []

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // Postgres convention : 1 = lundi, 7 = dimanche
    // JS : getDay() 0 = dimanche, 1 = lundi, ..., 6 = samedi
    const jsDay = d.getDay()
    const weekday = jsDay === 0 ? 7 : jsDay
    const dayIso = d.toISOString().slice(0, 10)

    for (const sl of slots) {
      if ((sl as any).weekday !== weekday) continue
      // Vérifier qu'une séance identique n'existe pas déjà
      const { data: dup } = await s.from('mission_sessions').select('id')
        .eq('session_date', dayIso)
        .eq('start_time', (sl as any).start_time)
        .eq('cfa_id', cfa_id)
        .maybeSingle()
      if (dup?.id) continue
      sessionsToInsert.push({
        mission_id: targetMissionId,
        cfa_id,
        session_date: dayIso,
        start_time: (sl as any).start_time,
        end_time: (sl as any).end_time,
        break_minutes: 0,
        room: (sl as any).room ?? null,
        trainer_id: (sl as any).trainer_id ?? null,
      })
    }
  }

  if (sessionsToInsert.length === 0) {
    redirect(`/weekly-schedule?cfa=${cfa_id}&toast=` + encodeURIComponent('Aucune nouvelle séance à créer (déjà toutes générées).') + '&toast_type=info')
  }

  const { error: insErr } = await s.from('mission_sessions').insert(sessionsToInsert)
  if (insErr) {
    redirect(`/weekly-schedule?cfa=${cfa_id}&toast=` + encodeURIComponent('Erreur : ' + insErr.message) + '&toast_type=error')
  }

  revalidatePath('/planning')
  revalidatePath('/dashboard')
  redirect(`/weekly-schedule?cfa=${cfa_id}&toast=` + encodeURIComponent(`${sessionsToInsert.length} séance(s) créée(s) sur la période.`))
}
