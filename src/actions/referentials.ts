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
export async function deleteTrainer(formData: FormData) {
 const s = createClient()
 const id = formData.get('id') as string
 const force = formData.get('force') === '1'
 if (!id) return

 // Vérifier qu'aucune donnée critique ne pointe vers ce formateur
 const [{ count: nbSessions }, { count: nbEntries }, { count: nbInvoices }] = await Promise.all([
  s.from('mission_sessions').select('*', { count: 'exact', head: true }).eq('trainer_id', id),
  s.from('time_entries').select('*', { count: 'exact', head: true }).eq('trainer_id', id),
  s.from('trainer_invoices').select('*', { count: 'exact', head: true }).eq('trainer_id', id),
 ])
 const total = (nbSessions ?? 0) + (nbEntries ?? 0) + (nbInvoices ?? 0)
 if (total > 0 && !force) {
  redirect(`/trainers/${id}?toast=` + encodeURIComponent(
   `Impossible de supprimer : ${nbSessions ?? 0} séance(s), ${nbEntries ?? 0} saisie(s), ${nbInvoices ?? 0} facture(s) rattachées. Utilisez « Suppression forcée » pour tout supprimer d'un coup, ou désactivez-le simplement.`
  ) + '&toast_type=error')
 }

 if (force) {
  // Suppression en cascade : factures, saisies, séances, docs, dispos, créneaux récurrents
  // Récupérer d'abord les ids des factures et saisies pour nettoyage des lignes
  const { data: invoices } = await s.from('trainer_invoices').select('id').eq('trainer_id', id)
  const invoiceIds = (invoices ?? []).map((x: any) => x.id)
  if (invoiceIds.length > 0) {
   await s.from('trainer_invoice_lines').delete().in('invoice_id', invoiceIds)
   await s.from('trainer_invoices').delete().in('id', invoiceIds)
  }
  // Récupérer les sessions pour nettoyer time_entries + documents
  const { data: sessions } = await s.from('mission_sessions').select('id').eq('trainer_id', id)
  const sessionIds = (sessions ?? []).map((x: any) => x.id)
  if (sessionIds.length > 0) {
   await s.from('time_entries').delete().in('session_id', sessionIds)
   await s.from('session_documents').delete().in('session_id', sessionIds)
   await s.from('mission_sessions').delete().in('id', sessionIds)
  }
  // Toutes les time_entries résiduelles (saisies de ce formateur sans session attachée à lui)
  await s.from('time_entries').delete().eq('trainer_id', id)
  // Historiques divers
  await s.from('session_substitutions').delete().eq('original_trainer_id', id)
  await s.from('session_substitutions').delete().eq('substitute_trainer_id', id)
  await s.from('trainer_absences').delete().eq('trainer_id', id)
  await s.from('deletion_requests').delete().eq('trainer_id', id)
 }

 // Nettoyage des références non-critiques (toujours)
 await s.from('trainer_availabilities').delete().eq('trainer_id', id)
 await s.from('trainer_documents').delete().eq('trainer_id', id)
 await s.from('weekly_schedule_slots').update({ trainer_id: null }).eq('trainer_id', id)

 const { error } = await s.from('trainers').delete().eq('id', id)
 if (error) {
  redirect(`/trainers/${id}?toast=` + encodeURIComponent('Erreur : ' + error.message) + '&toast_type=error')
 }
 revalidatePath('/trainers')
 redirect('/trainers?toast=' + encodeURIComponent(
  force
   ? 'Formateur supprimé avec toutes ses données associées (séances, saisies, factures).'
   : 'Formateur supprimé définitivement.'
 ))
}
