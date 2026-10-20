'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

/**
 * Formateur : soumet une demande de suppression pour une séance ou une mission.
 * target_type ∈ 'session' | 'mission'
 */
export async function requestDeletion(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return
  const { data: trainer } = await s.from('trainers').select('id').eq('user_id', user.id).single()
  if (!trainer) return

  const target_type = formData.get('target_type') as 'session' | 'mission'
  const target_id = formData.get('target_id') as string
  const reason = (formData.get('reason') as string) || null
  const return_to = (formData.get('return_to') as string) || '/sessions'

  if (!target_type || !target_id || !['session', 'mission'].includes(target_type)) return

  // Vérifier qu'il n'y a pas déjà une demande en cours
  const { data: existing } = await s.from('deletion_requests')
    .select('id')
    .eq('target_type', target_type).eq('target_id', target_id).eq('status', 'pending')
    .maybeSingle()
  if (existing) {
    const sep = return_to.includes('?') ? '&' : '?'
    redirect(return_to + sep + 'toast=' + encodeURIComponent('Une demande de suppression est déjà en attente pour cet élément.') + '&toast_type=info')
  }

  const { error } = await s.from('deletion_requests').insert({
    trainer_id: trainer.id,
    target_type,
    target_id,
    reason,
  })
  if (error) {
    console.error('[requestDeletion]', error)
    const sep = return_to.includes('?') ? '&' : '?'
    redirect(return_to + sep + 'toast=' + encodeURIComponent('Erreur : ' + error.message) + '&toast_type=error')
  }

  revalidatePath('/deletion-requests')
  revalidatePath(return_to)
  const sep = return_to.includes('?') ? '&' : '?'
  redirect(return_to + sep + 'toast=' + encodeURIComponent('Demande de suppression envoyée à l\'administrateur.') + '&toast_type=info')
}

/**
 * Admin : approuve la demande. Supprime effectivement l'élément cible.
 * - session : supprime la mission_session (cascade sur time_entries, session_documents)
 * - mission : supprime la mission (cascade sur mission_sessions et donc time_entries)
 */
export async function approveDeletion(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return
  const id = formData.get('id') as string
  if (!id) return

  const { data: req } = await s.from('deletion_requests').select('*').eq('id', id).single()
  if (!req || req.status !== 'pending') return

  // Supprimer l'élément cible
  let delError: any = null
  if (req.target_type === 'session') {
    // Nettoyer les docs liés
    await s.from('session_documents').delete().eq('session_id', req.target_id)
    await s.from('time_entries').delete().eq('session_id', req.target_id)
    const { error } = await s.from('mission_sessions').delete().eq('id', req.target_id)
    delError = error
  } else if (req.target_type === 'mission') {
    // Récupérer les séances pour nettoyer les docs
    const { data: sessions } = await s.from('mission_sessions').select('id').eq('mission_id', req.target_id)
    const sIds = (sessions ?? []).map((x: any) => x.id)
    if (sIds.length > 0) {
      await s.from('session_documents').delete().in('session_id', sIds)
      await s.from('time_entries').delete().in('session_id', sIds)
      await s.from('mission_sessions').delete().in('id', sIds)
    }
    const { error } = await s.from('missions').delete().eq('id', req.target_id)
    delError = error
  }

  if (delError) {
    console.error('[approveDeletion]', delError)
    redirect('/deletion-requests?toast=' + encodeURIComponent('Suppression impossible : ' + delError.message) + '&toast_type=error')
  }

  await s.from('deletion_requests').update({
    status: 'approved',
    decided_by: user.id,
    decided_at: new Date().toISOString(),
  }).eq('id', id)

  revalidatePath('/deletion-requests')
  revalidatePath('/missions')
  revalidatePath('/dashboard')
  redirect('/deletion-requests?toast=' + encodeURIComponent('Suppression effectuée et formateur notifié.'))
}

/**
 * Admin : rejette la demande (motif obligatoire).
 */
export async function rejectDeletion(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return
  const id = formData.get('id') as string
  const admin_comment = (formData.get('admin_comment') as string) || 'Refusé.'
  if (!id) return

  await s.from('deletion_requests').update({
    status: 'rejected',
    admin_comment,
    decided_by: user.id,
    decided_at: new Date().toISOString(),
  }).eq('id', id)

  revalidatePath('/deletion-requests')
  redirect('/deletion-requests?toast=' + encodeURIComponent('Demande refusée.') + '&toast_type=info')
}

/**
 * Formateur : annule sa propre demande tant qu'elle est en attente.
 */
export async function cancelDeletionRequest(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return
  const { data: trainer } = await s.from('trainers').select('id').eq('user_id', user.id).single()
  if (!trainer) return

  const id = formData.get('id') as string
  const return_to = (formData.get('return_to') as string) || '/sessions'
  if (!id) return

  await s.from('deletion_requests')
    .delete()
    .eq('id', id)
    .eq('trainer_id', trainer.id)
    .eq('status', 'pending')

  revalidatePath(return_to)
  const sep = return_to.includes('?') ? '&' : '?'
  redirect(return_to + sep + 'toast=' + encodeURIComponent('Demande annulée.') + '&toast_type=info')
}
