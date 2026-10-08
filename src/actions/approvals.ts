'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function approveProfile(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  const profileId = formData.get('profile_id') as string
  const newRole = (formData.get('role') as string) || 'trainer'
  // Infos pour pré-remplir la fiche formateur (saisies par l'admin dans le formulaire d'approbation)
  const firstNameRaw = ((formData.get('first_name') as string) || '').trim()
  const lastNameRaw = ((formData.get('last_name') as string) || '').trim()
  if (!profileId || !user) return

  // 1) Récupère le profil pour avoir l'email de référence
  const { data: prof } = await s.from('profiles')
    .select('email, first_name, last_name').eq('id', profileId).single()
  const email = prof?.email ?? ''
  const first = firstNameRaw || prof?.first_name || (email.split('@')[0] || 'Formateur')
  const last = lastNameRaw || prof?.last_name || ''

  // 2) Met à jour le profil (approbation + rôle + nom/prénom si renseignés)
  await s.from('profiles').update({
    approval_status: 'approved',
    approved_at: new Date().toISOString(),
    approved_by: user.id,
    rejection_reason: null,
    role: newRole,
    first_name: first,
    last_name: last,
  }).eq('id', profileId)

  // 3) Si rôle = formateur, crée (ou met à jour) sa fiche trainer liée à son user_id
  if (newRole === 'trainer') {
    const { data: existingTrainer } = await s.from('trainers')
      .select('id').eq('user_id', profileId).maybeSingle()

    if (existingTrainer) {
      // Fiche déjà présente : on la met juste à jour
      await s.from('trainers').update({
        first_name: first,
        last_name: last,
        email: email || null,
        active: true,
      }).eq('id', existingTrainer.id)
    } else {
      // Création d'une nouvelle fiche liée automatiquement
      const { error: tErr } = await s.from('trainers').insert({
        user_id: profileId,
        first_name: first,
        last_name: last,
        email: email || null,
        active: true,
      })
      if (tErr) {
        // Loggé côté serveur ; on ne bloque pas l'approbation
        console.error('[approveProfile] trainer insert error', tErr)
      }
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
