'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function submitTimeEntry(formData: FormData) {
  const s = createClient()
  const session_id = formData.get('session_id') as string
  const isDraft = formData.get('draft') === '1'

  const { data: { user } } = await s.auth.getUser()
  if (!user) return
  const { data: trainer } = await s.from('trainers').select('id').eq('user_id', user.id).single()
  const { data: session } = await s.from('mission_sessions').select('session_date, trainer_id').eq('id', session_id).single()
  if (!trainer || !session || session.trainer_id !== trainer.id) return

  const blocks = formData.getAll('blocks').map((v) => Number(v))
  const skill_ids = formData.getAll('skills').map((v) => String(v))

  const payload: any = {
    session_id,
    trainer_id: trainer.id,
    work_date: session.session_date,
    actual_start: formData.get('actual_start'),
    actual_end: formData.get('actual_end'),
    break_minutes: Number(formData.get('break_minutes') ?? 60),
    adjustment_reason: (formData.get('adjustment_reason') as string) || null,
    competence_blocks_targeted: blocks,
    skill_ids,
    content_covered: (formData.get('content_covered') as string) || null,
    pedagogical_supports: (formData.get('pedagogical_supports') as string) || null,
    work_done: (formData.get('work_done') as string) || null,
    points_to_review: (formData.get('points_to_review') as string) || null,
    program_completion: formData.get('program_completion') ? Number(formData.get('program_completion')) : null,
    status: isDraft ? 'draft' : 'submitted',
  }

  const { data: existing } = await s.from('time_entries').select('id').eq('session_id', session_id).maybeSingle()
  if (existing) {
    await s.from('time_entries').update(payload).eq('id', existing.id)
  } else {
    await s.from('time_entries').insert(payload)
  }
  revalidatePath('/sessions'); revalidatePath('/home')
  redirect('/sessions')
}

export async function validateEntry(formData: FormData) {
  const s = createClient()
  const entry_id = formData.get('entry_id') as string
  const { data: { user } } = await s.auth.getUser()
  await s.from('time_entries').update({
    status: 'validated', validated_by: user?.id, validated_at: new Date().toISOString(),
  }).eq('id', entry_id)
  revalidatePath('/validation'); revalidatePath('/dashboard')
}

/**
 * Change le CFA de la mission liée à une saisie (correction d'erreur par l'admin
 * depuis la page Validation). Applique le changement sur toutes les séances de
 * la mission pour que la facturation CFA pointe au bon endroit.
 * Si la saisie est une séance hors planning (pas de mission), change juste le CFA
 * de la séance elle-même.
 */
export async function changeEntryCfa(formData: FormData) {
  const s = createClient()
  const entry_id = formData.get('entry_id') as string
  const new_cfa_id = formData.get('cfa_id') as string
  if (!entry_id || !new_cfa_id) return

  // Récupérer la séance et sa mission
  const { data: entry } = await s.from('time_entries')
    .select('session_id, session:mission_sessions(id, mission_id)')
    .eq('id', entry_id).single()
  if (!entry) return

  const se: any = entry.session
  if (se?.mission_id) {
    // Cas 1 : mission planifiée → change le CFA de la mission + propage aux séances
    await s.from('missions').update({ cfa_id: new_cfa_id }).eq('id', se.mission_id)
    await s.from('mission_sessions').update({ cfa_id: new_cfa_id }).eq('mission_id', se.mission_id)
  } else if (se?.id) {
    // Cas 2 : séance hors planning → change juste le CFA de la séance
    await s.from('mission_sessions').update({ cfa_id: new_cfa_id }).eq('id', se.id)
  }
  revalidatePath('/validation')
}

/**
 * Dévalide une saisie précédemment validée (si l'admin a validé par erreur).
 * Remet la saisie en file d'attente avec le statut 'submitted'.
 */
export async function unvalidateEntry(formData: FormData) {
  const s = createClient()
  const entry_id = formData.get('entry_id') as string
  if (!entry_id) return
  await s.from('time_entries').update({
    status: 'submitted',
    validated_by: null,
    validated_at: null,
    admin_comment: null,
  }).eq('id', entry_id)
  revalidatePath('/validation')
  revalidatePath('/dashboard')
}

export async function refuseEntry(formData: FormData) {
  const s = createClient()
  const entry_id = formData.get('entry_id') as string
  const motif = (formData.get('motif') as string) || 'Non précisé'
  await s.from('time_entries').update({ status: 'refused', admin_comment: motif }).eq('id', entry_id)
  revalidatePath('/validation')
}

/**
 * Déclaration d'une séance hors planning par le formateur.
 * Crée une mission_session (self_declared=true) + une time_entry (status='submitted')
 * qui iront dans la file de validation admin.
 */
export async function declareSession(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return
  const { data: trainer } = await s.from('trainers').select('id').eq('user_id', user.id).single()
  if (!trainer) return

  const cfa_id = formData.get('cfa_id') as string
  const mission_id = (formData.get('mission_id') as string) || null
  const session_date = formData.get('session_date') as string
  const start_time = formData.get('start_time') as string
  const end_time = formData.get('end_time') as string
  const break_minutes = Number(formData.get('break_minutes') ?? 60)
  const room = (formData.get('room') as string) || null

  if (!cfa_id || !session_date || !start_time || !end_time) return

  // 1. Créer la mission_session avec self_declared=true
  const { data: session, error: sessErr } = await s.from('mission_sessions').insert({
    cfa_id,
    mission_id,
    session_date,
    start_time,
    end_time,
    break_minutes,
    room,
    trainer_id: trainer.id,
    self_declared: true,
    declared_by_trainer_id: trainer.id,
    status: 'realized',
  }).select('id').single()

  if (sessErr || !session) { console.error('declareSession session error:', sessErr); return }

  // 2. Créer le time_entry lié (status='submitted' → visible dans la file admin)
  const blocks = formData.getAll('blocks').map((v) => Number(v))
  const skill_ids = formData.getAll('skills').map((v) => String(v))

  await s.from('time_entries').insert({
    session_id: session.id,
    trainer_id: trainer.id,
    work_date: session_date,
    actual_start: start_time,
    actual_end: end_time,
    break_minutes,
    competence_blocks_targeted: blocks,
    skill_ids,
    content_covered: (formData.get('content_covered') as string) || null,
    pedagogical_supports: (formData.get('pedagogical_supports') as string) || null,
    work_done: (formData.get('work_done') as string) || null,
    points_to_review: (formData.get('points_to_review') as string) || null,
    program_completion: formData.get('program_completion') ? Number(formData.get('program_completion')) : null,
    trainer_comment: (formData.get('trainer_comment') as string) || null,
    status: 'submitted',
  })

  revalidatePath('/sessions'); revalidatePath('/home'); revalidatePath('/validation')
  redirect('/sessions?declared=1')
}

/**
 * Admin : rattacher une séance auto-déclarée à une mission existante (pendant la validation)
 */
export async function attachSessionToMission(formData: FormData) {
  const s = createClient()
  const session_id = formData.get('session_id') as string
  const mission_id = (formData.get('mission_id') as string) || null
  if (!session_id) return
  await s.from('mission_sessions').update({ mission_id }).eq('id', session_id)
  revalidatePath('/validation')
}
