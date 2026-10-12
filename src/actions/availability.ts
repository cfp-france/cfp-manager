'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function addWeeklyAvailability(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return
  const { data: trainer } = await s.from('trainers').select('id').eq('user_id', user.id).single()
  if (!trainer) return

  const weekday = Number(formData.get('weekday'))
  const start_time = formData.get('start_time') as string
  const end_time = formData.get('end_time') as string
  const note = (formData.get('note') as string) || null
  if (isNaN(weekday) || !start_time || !end_time) return

  await s.from('trainer_availabilities').insert({
    trainer_id: trainer.id,
    kind: 'weekly',
    weekday,
    start_time,
    end_time,
    note,
  })
  revalidatePath('/availability')
  redirect('/availability?toast=' + encodeURIComponent('Disponibilité ajoutée.'))
}

export async function addExceptionalAvailability(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return
  const { data: trainer } = await s.from('trainers').select('id').eq('user_id', user.id).single()
  if (!trainer) return

  const specific_date = formData.get('specific_date') as string
  const start_time = formData.get('start_time') as string
  const end_time = formData.get('end_time') as string
  const note = (formData.get('note') as string) || null
  if (!specific_date || !start_time || !end_time) return

  const weekday = new Date(specific_date).getDay()
  await s.from('trainer_availabilities').insert({
    trainer_id: trainer.id,
    kind: 'exceptional',
    specific_date,
    weekday,
    start_time,
    end_time,
    note,
  })
  revalidatePath('/availability')
  redirect('/availability?toast=' + encodeURIComponent('Disponibilité ponctuelle ajoutée.'))
}

export async function deleteAvailability(formData: FormData) {
  const s = createClient()
  const id = formData.get('id') as string
  if (!id) return
  await s.from('trainer_availabilities').delete().eq('id', id)
  revalidatePath('/availability')
}
