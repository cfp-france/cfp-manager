'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function submitAbsence(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return
  const { data: trainer } = await s.from('trainers').select('id').eq('user_id', user.id).single()
  if (!trainer) return

  const start = formData.get('start_date') as string
  const end = formData.get('end_date') as string
  const { data: affected } = await s.from('mission_sessions').select('id')
    .eq('trainer_id', trainer.id).gte('session_date', start).lte('session_date', end)

  await s.from('trainer_absences').insert({
    trainer_id: trainer.id,
    start_date: start, end_date: end,
    reason: formData.get('reason'),
    reason_detail: (formData.get('reason_detail') as string) || null,
    affected_session_ids: (affected ?? []).map((x: any) => x.id),
    status: 'submitted',
  })
  revalidatePath('/absence')
  redirect('/absence')
}

export async function reviewAbsence(formData: FormData) {
  const s = createClient()
  const absence_id = formData.get('absence_id') as string
  const decision = formData.get('decision') as 'accepted' | 'refused'
  const { data: { user } } = await s.auth.getUser()

  const { data: abs } = await s.from('trainer_absences').select('affected_session_ids').eq('id', absence_id).single()

  await s.from('trainer_absences').update({
    status: decision, reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
  }).eq('id', absence_id)

  // Si acceptée, marquer les séances comme "needs_substitution"
  if (decision === 'accepted' && abs?.affected_session_ids?.length) {
    await s.from('mission_sessions').update({ needs_substitution: true }).in('id', abs.affected_session_ids)
  }
  revalidatePath('/absences'); revalidatePath('/substitutions'); revalidatePath('/dashboard')
}
