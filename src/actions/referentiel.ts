'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// ─────────────── Formations ───────────────

export async function createFormation(formData: FormData) {
  const s = createClient()
  const p = Object.fromEntries(formData) as any
  if (!p.code || !p.name) return
  const { data } = await s.from('formations').insert({
    code: p.code.trim().toUpperCase().replace(/\s+/g, '_'),
    name: p.name.trim(),
    description: p.description || null,
  }).select('id').single()
  revalidatePath('/referentiels')
  if (data?.id) redirect(`/referentiels/${data.id}`)
}

export async function updateFormation(formData: FormData) {
  const s = createClient()
  const p = Object.fromEntries(formData) as any
  if (!p.id) return
  await s.from('formations').update({
    code: p.code?.trim().toUpperCase().replace(/\s+/g, '_'),
    name: p.name?.trim(),
    description: p.description || null,
  }).eq('id', p.id)
  revalidatePath('/referentiels')
  revalidatePath(`/referentiels/${p.id}`)
}

export async function archiveFormation(formData: FormData) {
  const s = createClient()
  const id = formData.get('id') as string
  if (!id) return
  await s.from('formations').update({ archived_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/referentiels')
}

export async function unarchiveFormation(formData: FormData) {
  const s = createClient()
  const id = formData.get('id') as string
  if (!id) return
  await s.from('formations').update({ archived_at: null }).eq('id', id)
  revalidatePath('/referentiels')
}

// ─────────────── Matières / Blocs ───────────────

export async function createBlock(formData: FormData) {
  const s = createClient()
  const p = Object.fromEntries(formData) as any
  if (!p.formation_id || !p.number || !p.title) return
  await s.from('competence_blocks').insert({
    formation_id: p.formation_id,
    number: Number(p.number),
    title: p.title.trim(),
  })
  revalidatePath(`/referentiels/${p.formation_id}`)
}

export async function updateBlock(formData: FormData) {
  const s = createClient()
  const p = Object.fromEntries(formData) as any
  if (!p.id) return
  await s.from('competence_blocks').update({
    number: Number(p.number),
    title: p.title?.trim(),
  }).eq('id', p.id)
  revalidatePath(`/referentiels/${p.formation_id}`)
}

export async function deleteBlock(formData: FormData) {
  const s = createClient()
  const id = formData.get('id') as string
  const formationId = formData.get('formation_id') as string
  if (!id) return
  await s.from('competence_blocks').delete().eq('id', id)
  revalidatePath(`/referentiels/${formationId}`)
}

// ─────────────── Compétences ───────────────

export async function createSkill(formData: FormData) {
  const s = createClient()
  const p = Object.fromEntries(formData) as any
  if (!p.block_id || !p.number || !p.label) return
  await s.from('skills').insert({
    block_id: p.block_id,
    number: Number(p.number),
    label: p.label.trim(),
  })
  revalidatePath(`/referentiels/${p.formation_id}/${p.block_id}`)
  revalidatePath(`/referentiels/${p.formation_id}`)
}

export async function updateSkill(formData: FormData) {
  const s = createClient()
  const p = Object.fromEntries(formData) as any
  if (!p.id) return
  await s.from('skills').update({
    number: Number(p.number),
    label: p.label?.trim(),
  }).eq('id', p.id)
  revalidatePath(`/referentiels/${p.formation_id}/${p.block_id}`)
}

export async function deleteSkill(formData: FormData) {
  const s = createClient()
  const id = formData.get('id') as string
  const blockId = formData.get('block_id') as string
  const formationId = formData.get('formation_id') as string
  if (!id) return
  await s.from('skills').delete().eq('id', id)
  revalidatePath(`/referentiels/${formationId}/${blockId}`)
}
