'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function assignSubstitute(formData: FormData) {
  const s = createClient()
  const session_id = formData.get('session_id') as string
  const substitute_trainer_id = formData.get('trainer_id') as string
  const { data: { user } } = await s.auth.getUser()

  const { data: sess } = await s.from('mission_sessions').select('trainer_id').eq('id', session_id).single()

  await s.from('session_substitutions').insert({
    session_id,
    original_trainer_id: sess?.trainer_id ?? null,
    substitute_trainer_id,
    status: 'confirmed',
    confirmed_by: user?.id ?? null,
  })

  await s.from('mission_sessions').update({
    trainer_id: substitute_trainer_id, needs_substitution: false,
  }).eq('id', session_id)

  revalidatePath('/substitutions'); revalidatePath('/dashboard')
}
