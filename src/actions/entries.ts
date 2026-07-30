'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function submitTimeEntry(formData: FormData) {
  const s = createClient()
  const session_id = formData.get('session_id') as string
  const isDraft = formData.get('draft') === '1'

  const { data: { user } } = await s.auth.getUser()
  if (!user) return
  const { data: trainer } = await s.from('trainers').select('id').eq('user_id', user.id).single()
  const { data: session } = await s.from('mission_sessions').select('session_date, trainer_id').eq('id', session_id).single()
  if (!trainer || !session || session.trainer_id !== trainer.id) return

  const blocks = formData.getAll('blocks').map((v) => Number(v))
  const skill_ids = formData.getAll('skills').map((v) => String(v))

  const payload: any = {
    session_id,
    trainer_id: trainer.id,
    work_date: session.session_date,
    actual_start: formData.get('actual_start'),
    actual_end: formData.get('actual_end'),
    break_minutes: Number(formData.get('break_minutes') ?? 60),
    adjustment_reason: (formData.get('adjustment_reason') as string) || null,
    competence_blocks_targeted: blocks,
    skill_ids,
    content_covered: (formData.get('content_covered') as string) || null,
    pedagogical_supports: (formData.get('pedagogical_supports') as string) || null,
    work_done: (formData.get('work_done') as string) || null,
    points_to_review: (formData.get('points_to_review') as string) || null,
    program_completion: formData.get('program_completion') ? Number(formData.get('program_completion')) : null,
    status: isDraft ? 'draft' : 'submitted',
  }

  const { data: existing } = await s.from('time_entries').select('id').eq('session_id', session_id).maybeSingle()
  if (existing) {
    await s.from('time_entries').update(payload).eq('id', existing.id)
  } else {
    await s.from('time_entries').insert(payload)
  }
  revalidatePath('/sessions'); revalidatePath('/home')
  redirect('/sessions')
}

export async function validateEntry(formData: FormData) {
  const s = createClient()
  const entry_id = formData.get('entry_id') as string
  const { data: { user } } = await s.auth.getUser()
  await s.from('time_entries').update({
    status: 'validated', validated_by: user?.id, validated_at: new Date().toISOString(),
  }).eq('id', entry_id)
  revalidatePath('/validation'); revalidatePath('/dashboard')
}

export async function refuseEntry(formData: FormData) {
  const s = createClient()
  const entry_id = formData.get('entry_id') as string
  const motif = (formData.get('motif') as string) || 'Non précisé'
  await s.from('time_entries').update({ status: 'refused', admin_comment: motif }).eq('id', entry_id)
  revalidatePath('/validation')
}
