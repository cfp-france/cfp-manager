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
