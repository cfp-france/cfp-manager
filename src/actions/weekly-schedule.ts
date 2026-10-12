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
