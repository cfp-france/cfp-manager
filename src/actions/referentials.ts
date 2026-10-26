'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createCfa(formData: FormData) {
 const s = createClient()
 const p = Object.fromEntries(formData) as any
 await s.from('cfa').insert({
 name: p.name,
 city: p.city || null,
 address: p.address || null,
 phone: p.phone || null,
 email: p.email || null,
 siret: p.siret || null,
 pedagogic_contact: p.pedagogic_contact || null,
 admin_contact: p.admin_contact || null,
 billing_notes: p.billing_notes || null,
 default_hourly_rate: p.default_hourly_rate ? Number(p.default_hourly_rate) : null,
 })
 revalidatePath('/cfa')
}

export async function updateCfa(formData: FormData) {
 const s = createClient()
 const p = Object.fromEntries(formData) as any
 const id = p.id
 if (!id) return
 await s.from('cfa').update({
 name: p.name,
 city: p.city || null,
 address: p.address || null,
 phone: p.phone || null,
 email: p.email || null,
 siret: p.siret || null,
 pedagogic_contact: p.pedagogic_contact || null,
 admin_contact: p.admin_contact || null,
 billing_notes: p.billing_notes || null,
 default_hourly_rate: p.default_hourly_rate ? Number(p.default_hourly_rate) : null,
 }).eq('id', id)
 revalidatePath('/cfa')
 revalidatePath(`/cfa/${id}`)
 redirect('/cfa')
}

export async function archiveCfa(formData: FormData) {
 const s = createClient()
 const id = formData.get('id') as string
 if (!id) return
 await s.from('cfa').update({ archived_at: new Date().toISOString() }).eq('id', id)
 revalidatePath('/cfa')
 redirect('/cfa')
}

export async function unarchiveCfa(formData: FormData) {
 const s = createClient()
 const id = formData.get('id') as string
 if (!id) return
 await s.from('cfa').update({ archived_at: null }).eq('id', id)
 revalidatePath('/cfa')
 redirect('/cfa')
}

export async function createTrainer(formData: FormData) {
 const s = createClient()
 const p = Object.fromEntries(formData) as any
 const specialties = p.specialties ? String(p.specialties).split(',').map((x: string) => x.trim()).filter(Boolean) : []
 await s.from('trainers').insert({
 first_name: p.first_name,
 last_name: p.last_name,
 email: p.email || null,
 phone: p.phone || null,
 siret: p.siret || null,
 nda: p.nda || null,
 hourly_rate_default: p.hourly_rate_default ? Number(p.hourly_rate_default) : null,
 specialties,
 })
 revalidatePath('/trainers')
}

export async function updateTrainer(formData: FormData) {
 const s = createClient()
 const p = Object.fromEntries(formData) as any
 const id = p.id
 if (!id) return
 const specialties = p.specialties ? String(p.specialties).split(',').map((x: string) => x.trim()).filter(Boolean) : []
 await s.from('trainers').update({
 first_name: p.first_name,
 last_name: p.last_name,
 email: p.email || null,
 phone: p.phone || null,
 siret: p.siret || null,
 nda: p.nda || null,
 legal_status: p.legal_status || null,
 company_name: p.company_name || null,
 vat_number: p.vat_number || null,
 billing_address: p.billing_address || null,
 iban: p.iban || null,
 bic: p.bic || null,
 hourly_rate_default: p.hourly_rate_default ? Number(p.hourly_rate_default) : null,
 specialties,
 }).eq('id', id)
 revalidatePath('/trainers')
 revalidatePath(`/trainers/${id}`)
 redirect('/trainers')
}

export async function toggleTrainerActive(formData: FormData) {
 const s = createClient()
 const id = formData.get('id') as string
 const activate = formData.get('activate') === '1'
 if (!id) return
 await s.from('trainers').update({ active: activate }).eq('id', id)
 revalidatePath('/trainers')
 redirect('/trainers')
}

export async function linkTrainerToUser(formData: FormData) {
 const s = createClient()
 const trainer_id = formData.get('trainer_id') as string
 const user_id = formData.get('user_id') as string
 if (!trainer_id || !user_id) return
 await s.from('trainers').update({ user_id }).eq('id', trainer_id)
 revalidatePath('/trainers')
}

export async function unlinkTrainerFromUser(formData: FormData) {
 const s = createClient()
 const trainer_id = formData.get('trainer_id') as string
 if (!trainer_id) return
 await s.from('trainers').update({ user_id: null }).eq('id', trainer_id)
 revalidatePath('/trainers')
 revalidatePath(`/trainers/${trainer_id}`)
}

/**
 * Génère un mot de passe temporaire pour le formateur et l'applique directement
 * dans auth.users (via SQL car on n'a pas le service role ici). Le mot de passe
 * est affiché en clair à l'admin (via le toast) UNE SEULE FOIS, à transmettre
 * au formateur qui devra le changer à sa prochaine connexion.
 *
 * Note : il est TECHNIQUEMENT IMPOSSIBLE de récupérer le mot de passe actuel
 * d'un utilisateur — Supabase (comme toute app sérieuse) stocke un hash bcrypt
 * à sens unique. On peut uniquement en définir un nouveau.
 */
export async function resetTrainerPassword(formData: FormData) {
 const s = createClient()
 const trainer_id = formData.get('id') as string
 if (!trainer_id) return

 const { data: trainer } = await s.from('trainers').select('user_id, first_name, last_name').eq('id', trainer_id).single()
 if (!trainer?.user_id) {
  redirect(`/trainers/${trainer_id}?toast=` + encodeURIComponent('Ce formateur n\'a pas de compte lié. Impossible de réinitialiser.') + '&toast_type=error')
 }

 // Génère un mot de passe aléatoire mémorisable : Mot4chiffres + Nom + !
 const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
 const digits = '23456789'
 let rand = ''
 for (let i = 0; i < 3; i++) rand += letters[Math.floor(Math.random() * letters.length)]
 for (let i = 0; i < 3; i++) rand += digits[Math.floor(Math.random() * digits.length)]
 const newPassword = `CFP-${rand}`

 // UPDATE direct dans auth.users via pgcrypto
 const { error } = await s.rpc('admin_reset_trainer_password', {
  p_user_id: trainer.user_id,
  p_new_password: newPassword,
 })
 if (error) {
  console.error('[resetTrainerPassword]', error)
  redirect(`/trainers/${trainer_id}?toast=` + encodeURIComponent('Erreur : ' + error.message) + '&toast_type=error')
 }

 revalidatePath(`/trainers/${trainer_id}`)
 redirect(`/trainers/${trainer_id}?toast=` + encodeURIComponent(
  `Mot de passe réinitialisé pour ${trainer.first_name} ${trainer.last_name} → ${newPassword}  (à communiquer de façon sécurisée — le formateur devra le changer après connexion)`
 ))
}

/**
 * Supprime définitivement un formateur. Bloque si des données le référencent
 * (séances, saisies, factures) : dans ce cas, suggère la désactivation.
 */
/**
 * « Supprime » un formateur = archivage logique.
 * Le formateur disparaît des listes et dropdowns, mais toutes ses données
 * historiques (séances passées, saisies validées, factures) restent intactes
 * pour la traçabilité comptable et pédagogique.
 *
 * Concrètement : active=false + archived_at=now(). Les requêtes
 * `.is('archived_at', null).eq('active', true)` l'excluent partout.
 *
 * Nettoyage limité :
 *   - Créneaux récurrents : trainer_id → NULL (créneau devient "À POURVOIR")
 *   - Mission_sessions FUTURES sans saisie : trainer_id → NULL (séance à repourvoir)
 *   - Compte auth lié : optionnellement délié (pour qu'il ne puisse plus se connecter)
 */
export async function deleteTrainer(formData: FormData) {
 const s = createClient()
 const id = formData.get('id') as string
 if (!id) return

 const today = new Date().toISOString().slice(0, 10)

 // 1. Libérer les créneaux récurrents : plus affectés à ce formateur
 await s.from('weekly_schedule_slots').update({ trainer_id: null }).eq('trainer_id', id)

 // 2. Pour les séances FUTURES qui n'ont pas encore de saisie : enlever le formateur
 //    (sinon la séance apparaîtrait "orpheline" dans le futur avec un formateur archivé)
 const { data: futureSessions } = await s.from('mission_sessions')
  .select('id')
  .eq('trainer_id', id)
  .gte('session_date', today)
 const futureIds = (futureSessions ?? []).map((x: any) => x.id)
 if (futureIds.length > 0) {
  // Garder seulement celles sans time_entry (sinon on garde l'historique)
  const { data: entriesForFuture } = await s.from('time_entries').select('session_id').in('session_id', futureIds)
  const sessionsWithEntries = new Set((entriesForFuture ?? []).map((e: any) => e.session_id))
  const futureNoEntries = futureIds.filter(sid => !sessionsWithEntries.has(sid))
  if (futureNoEntries.length > 0) {
   await s.from('mission_sessions').update({ trainer_id: null, needs_substitution: true }).in('id', futureNoEntries)
  }
 }

 // 3. Délier le compte de connexion (ne peut plus se connecter)
 await s.from('trainers').update({ user_id: null }).eq('id', id)

 // 4. Archivage logique
 const { error } = await s.from('trainers')
  .update({ active: false, archived_at: new Date().toISOString() })
  .eq('id', id)
 if (error) {
  redirect(`/trainers/${id}?toast=` + encodeURIComponent('Erreur : ' + error.message) + '&toast_type=error')
 }

 revalidatePath('/trainers')
 revalidatePath('/planning')
 revalidatePath('/weekly-schedule')
 redirect('/trainers?toast=' + encodeURIComponent(
  'Formateur supprimé. Ses séances passées et saisies restent conservées pour l\'historique.'
 ))
}
