'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function assignSubstitute(formData: FormData) {
 const s = createClient()
 const session_id = formData.get('session_id') as string
 const substitute_trainer_id = formData.get('trainer_id') as string
 const return_to = (formData.get('return_to') as string) || '/substitutions'
 const { data: { user } } = await s.auth.getUser()

 if (!session_id || !substitute_trainer_id) {
  const sep = return_to.includes('?') ? '&' : '?'
  redirect(return_to + sep + 'toast=' + encodeURIComponent('Formateur non sélectionné.') + '&toast_type=error')
 }

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

 revalidatePath('/substitutions'); revalidatePath('/dashboard'); revalidatePath('/planning'); revalidatePath('/weekly-schedule')
 const sep = return_to.includes('?') ? '&' : '?'
 redirect(return_to + sep + 'toast=' + encodeURIComponent('Remplacement programmé.'))
}

/**
 * Admin : déprogramme le formateur d'une séance (le créneau redevient « À pourvoir »).
 * Marque needs_substitution=true pour qu'il apparaisse dans la file des remplacements à pourvoir.
 */
export async function clearSessionTrainer(formData: FormData) {
 const s = createClient()
 const session_id = formData.get('session_id') as string
 const return_to = (formData.get('return_to') as string) || '/planning'
 if (!session_id) return

 const { data: sess } = await s.from('mission_sessions').select('trainer_id').eq('id', session_id).single()

 await s.from('mission_sessions').update({
  trainer_id: null,
  needs_substitution: true,
 }).eq('id', session_id)

 // Trace de l'historique (optionnel)
 if (sess?.trainer_id) {
  const { data: { user } } = await s.auth.getUser()
  await s.from('session_substitutions').insert({
   session_id,
   original_trainer_id: sess.trainer_id,
   substitute_trainer_id: null,
   status: 'pending',
   confirmed_by: user?.id ?? null,
  })
 }

 revalidatePath('/substitutions'); revalidatePath('/dashboard'); revalidatePath('/planning'); revalidatePath('/weekly-schedule')
 const sep = return_to.includes('?') ? '&' : '?'
 redirect(return_to + sep + 'toast=' + encodeURIComponent('Formateur déprogrammé. Le créneau est à pourvoir.') + '&toast_type=info')
}
