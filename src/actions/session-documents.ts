'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function uploadSessionDocument(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) redirect('/login')

  const session_id = formData.get('session_id') as string
  const file = formData.get('file') as File
  const label = (formData.get('label') as string) || null
  if (!session_id || !file || file.size === 0) return
  if (file.size > 20 * 1024 * 1024) {
    redirect(`/sessions/${session_id}?toast=` + encodeURIComponent('Fichier trop volumineux (max 20 Mo).') + '&toast_type=error')
  }

  // Récupérer la fiche trainer et vérifier qu'elle possède bien la séance
  const { data: trainer } = await s.from('trainers').select('id').eq('user_id', user.id).maybeSingle()
  const { data: session } = await s.from('mission_sessions').select('id, trainer_id').eq('id', session_id).single()
  if (!session) return

  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)}`
  const path = `${session_id}/${safeName}`

  const buf = await file.arrayBuffer()
  const { error: upErr } = await s.storage.from('session-docs').upload(path, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (upErr) {
    redirect(`/sessions/${session_id}?toast=` + encodeURIComponent('Erreur upload : ' + upErr.message) + '&toast_type=error')
  }

  await s.from('session_documents').insert({
    session_id,
    trainer_id: trainer?.id ?? session.trainer_id,
    label: label || file.name,
    storage_path: path,
    mime_type: file.type || null,
    size_bytes: file.size,
    uploaded_by: user.id,
  })

  revalidatePath(`/sessions/${session_id}`)
  redirect(`/sessions/${session_id}?toast=` + encodeURIComponent('Support ajouté.'))
}

export async function deleteSessionDocument(formData: FormData) {
  const s = createClient()
  const id = formData.get('id') as string
  const session_id = formData.get('session_id') as string
  if (!id) return
  const { data: doc } = await s.from('session_documents').select('storage_path').eq('id', id).single()
  if (doc?.storage_path) await s.storage.from('session-docs').remove([doc.storage_path])
  await s.from('session_documents').delete().eq('id', id)
  revalidatePath(`/sessions/${session_id}`)
}

export async function downloadSessionDocAction(formData: FormData) {
  const s = createClient()
  const path = formData.get('path') as string
  if (!path) return
  const { data } = await s.storage.from('session-docs').createSignedUrl(path, 600)
  if (data?.signedUrl) redirect(data.signedUrl)
}
