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
 * Admin : affecte / remplace / déprogramme un formateur sur UNE occurrence d'un créneau
 * récurrent (template non encore instancié).
 *
 * Si une mission_session existe déjà pour (session_date, start_time, cfa_id) → on la met à jour.
 * Sinon → on la crée à la volée (mission_id=null, c'est une séance rattachée au CFA directement).
 *
 * Valeur de trainer_id vide → déprogrammation (needs_substitution=true, trainer_id=null).
 */
export async function assignTrainerForTemplateOccurrence(formData: FormData) {
 const s = createClient()
 const cfa_id = formData.get('cfa_id') as string
 const session_date = formData.get('session_date') as string
 const start_time = formData.get('start_time') as string
 const end_time = formData.get('end_time') as string
 const room = (formData.get('room') as string) || null
 const trainer_id_raw = (formData.get('trainer_id') as string) || ''
 const new_trainer_id = trainer_id_raw === '' ? null : trainer_id_raw
 const return_to = (formData.get('return_to') as string) || '/planning'

 if (!cfa_id || !session_date || !start_time || !end_time) {
  const sep = return_to.includes('?') ? '&' : '?'
  redirect(return_to + sep + 'toast=' + encodeURIComponent('Infos manquantes.') + '&toast_type=error')
 }

 // Normalise HH:MM:SS vs HH:MM
 const norm = (t: string) => t.length === 5 ? t + ':00' : t
 const st = norm(start_time)

 // Cherche une mission_session existante pour la même date/horaire/CFA
 const { data: existing } = await s.from('mission_sessions')
  .select('id, trainer_id, mission_id')
  .eq('session_date', session_date)
  .eq('cfa_id', cfa_id)
  .eq('start_time', st)
  .maybeSingle()

 let targetSessionId: string | null = existing?.id ?? null
 const prevTrainerId = existing?.trainer_id ?? null

 if (!targetSessionId) {
  // Création à la volée : récupérer une mission par défaut du CFA (optionnel)
  const { data: defaultMission } = await s.from('missions')
   .select('id').eq('cfa_id', cfa_id).is('archived_at', null).limit(1).maybeSingle()
  const { data: created, error } = await s.from('mission_sessions').insert({
   mission_id: defaultMission?.id ?? null,
   cfa_id,
   session_date,
   start_time: st,
   end_time: norm(end_time),
   break_minutes: 0,
   room,
   trainer_id: new_trainer_id,
   needs_substitution: new_trainer_id === null,
  }).select('id').single()
  if (error || !created) {
   const sep = return_to.includes('?') ? '&' : '?'
   redirect(return_to + sep + 'toast=' + encodeURIComponent('Erreur création séance : ' + (error?.message ?? 'inconnue')) + '&toast_type=error')
  }
  targetSessionId = created.id
 } else {
  // Mise à jour trainer_id sur la séance existante
  await s.from('mission_sessions').update({
   trainer_id: new_trainer_id,
   needs_substitution: new_trainer_id === null,
  }).eq('id', targetSessionId)
 }

 // Trace dans session_substitutions
 const { data: { user } } = await s.auth.getUser()
 if (prevTrainerId || new_trainer_id) {
  await s.from('session_substitutions').insert({
   session_id: targetSessionId,
   original_trainer_id: prevTrainerId,
   substitute_trainer_id: new_trainer_id,
   status: new_trainer_id === null ? 'pending' : 'confirmed',
   confirmed_by: user?.id ?? null,
  })
 }

 revalidatePath('/planning'); revalidatePath('/dashboard'); revalidatePath('/weekly-schedule'); revalidatePath('/substitutions')
 const sep = return_to.includes('?') ? '&' : '?'
 const msg = new_trainer_id === null
  ? 'Formateur déprogrammé. Le créneau est à pourvoir.'
  : 'Remplacement programmé.'
 redirect(return_to + sep + 'toast=' + encodeURIComponent(msg))
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
