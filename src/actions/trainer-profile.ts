'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

/**
 * Permet au formateur connecté d'éditer sa propre fiche
 * (coordonnées, statut juridique, SIRET, NDA, RIB, etc.).
 */
export async function updateMyTrainerProfile(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) redirect('/login')
  const { data: trainer } = await s.from('trainers').select('id').eq('user_id', user.id).single()
  if (!trainer) return

  const p = Object.fromEntries(formData) as any
  await s.from('trainers').update({
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email || null,
    phone: p.phone || null,
    legal_status: p.legal_status || null,
    company_name: p.company_name || null,
    siret: p.siret || null,
    nda: p.nda || null,
    vat_number: p.vat_number || null,
    billing_address: p.billing_address || null,
    iban: p.iban || null,
    bic: p.bic || null,
  }).eq('id', trainer.id)

  revalidatePath('/profile')
  redirect('/profile?saved=1')
}
