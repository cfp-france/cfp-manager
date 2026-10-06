'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const DOC_TYPES = ['cv','diplome','kbis','insee','inpi','rib','assurance','autre'] as const

export async function uploadMyDocument(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié' }
  const { data: trainer } = await s.from('trainers').select('id').eq('user_id', user.id).single()
  if (!trainer) return { ok: false, error: 'Pas de fiche formateur liée' }

  const file = formData.get('file') as File
  const doc_type = (formData.get('doc_type') as string) || 'autre'
  const label = (formData.get('label') as string) || null
  if (!file || !(DOC_TYPES as readonly string[]).includes(doc_type)) return { ok: false, error: 'Paramètres invalides' }
  if (file.size === 0) return { ok: false, error: 'Fichier vide' }
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: 'Fichier > 10 Mo' }

  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
  const safeName = `${doc_type}_${Date.now()}.${ext}`
  const path = `${trainer.id}/${safeName}`

  const buf = await file.arrayBuffer()
  const { error: upErr } = await s.storage.from('trainer-docs').upload(path, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (upErr) return { ok: false, error: upErr.message }

  await s.from('trainer_documents').insert({
    trainer_id: trainer.id,
    doc_type,
    label: label || file.name,
    storage_path: path,
    mime_type: file.type || null,
    size_bytes: file.size,
    uploaded_by: user.id,
  })

  revalidatePath('/profile')
  return { ok: true }
}

export async function deleteMyDocument(formData: FormData) {
  const s = createClient()
  const id = formData.get('id') as string
  if (!id) return
  const { data: doc } = await s.from('trainer_documents').select('storage_path').eq('id', id).single()
  if (doc?.storage_path) {
    await s.storage.from('trainer-docs').remove([doc.storage_path])
  }
  await s.from('trainer_documents').delete().eq('id', id)
  revalidatePath('/profile')
  revalidatePath('/trainers')
}

/** URL signée (valide 10 minutes) pour télécharger un document. */
export async function getSignedDocUrl(storage_path: string) {
  const s = createClient()
  const { data } = await s.storage.from('trainer-docs').createSignedUrl(storage_path, 600)
  return data?.signedUrl ?? null
}

/** Action formulaire : redirige vers l'URL signée. */
export async function downloadDocAction(formData: FormData) {
  const path = formData.get('path') as string
  if (!path) return
  const url = await getSignedDocUrl(path)
  if (url) {
    const { redirect } = await import('next/navigation')
    redirect(url)
  }
}
