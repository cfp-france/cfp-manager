'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function approveProfile(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  const profileId = formData.get('profile_id') as string
  const newRole = (formData.get('role') as string) || 'trainer'
  if (!profileId || !user) return

  // 1) Met à jour l'approbation + le rôle sur le profil
  await s.from('profiles').update({
    approval_status: 'approved',
    approved_at: new Date().toISOString(),
    approved_by: user.id,
    rejection_reason: null,
    role: newRole,
  }).eq('id', profileId)

  // 2) Si le rôle est 'trainer', on crée automatiquement une fiche trainer
  //    liée à ce user (si elle n'existe pas déjà).
  if (newRole === 'trainer') {
    const { data: existingTrainer } = await s.from('trainers').select('id').eq('user_id', profileId).maybeSingle()
    if (!existingTrainer) {
      const { data: prof } = await s.from('profiles').select('email, first_name, last_name').eq('id', profileId).single()
      const email = prof?.email ?? ''
      const first = prof?.first_name || email.split('@')[0] || 'Formateur'
      const last = prof?.last_name || ''
      await s.from('trainers').insert({
        user_id: profileId,
        first_name: first,
        last_name: last,
        email,
        active: true,
      })
    }
  }

  revalidatePath('/approvals')
  revalidatePath('/trainers')
}

export async function rejectProfile(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  const profileId = formData.get('profile_id') as string
  const reason = (formData.get('reason') as string) || null
  if (!profileId || !user) return

  await s.from('profiles').update({
    approval_status: 'rejected',
    rejection_reason: reason,
    approved_by: user.id,
    approved_at: new Date().toISOString(),
  }).eq('id', profileId)

  revalidatePath('/approvals')
}

export async function revokeApproval(formData: FormData) {
  const s = createClient()
  const profileId = formData.get('profile_id') as string
  if (!profileId) return
  await s.from('profiles').update({
    approval_status: 'pending',
    approved_at: null,
    approved_by: null,
    rejection_reason: null,
  }).eq('id', profileId)
  revalidatePath('/approvals')
}
