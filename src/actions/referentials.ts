'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createCfa(formData: FormData) {
  const s = createClient()
  const payload = Object.fromEntries(formData) as any
  await s.from('cfa').insert({
    name: payload.name,
    city: payload.city || null,
    address: payload.address || null,
    phone: payload.phone || null,
    email: payload.email || null,
    siret: payload.siret || null,
    pedagogic_contact: payload.pedagogic_contact || null,
    admin_contact: payload.admin_contact || null,
  })
  revalidatePath('/cfa')
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

export async function linkTrainerToUser(formData: FormData) {
  const s = createClient()
  const trainer_id = formData.get('trainer_id') as string
  const user_id = formData.get('user_id') as string
  if (!trainer_id || !user_id) return
  await s.from('trainers').update({ user_id }).eq('id', trainer_id)
  revalidatePath('/trainers')
}
