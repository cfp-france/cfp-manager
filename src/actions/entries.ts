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

 // Robustesse : s'il existait plusieurs lignes (bug historique), on prend la plus récente
 // et on l'update plutôt que d'en créer une nouvelle qui écraserait les anciennes données affichées.
 const { data: existingRows } = await s.from('time_entries')
   .select('id, status')
   .eq('session_id', session_id)
   .order('created_at', { ascending: false })
   .limit(1)
 const existing = existingRows?.[0]
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
 redirect('/validation?toast=' + encodeURIComponent('Saisie validée. Heures prises en compte dans le tableau de bord et la facturation.'))
}

/**
 * Modifie les heures effectives d'une saisie (par l'admin, depuis la page Validation).
 * Utile quand le formateur s'est trompé en déclarant plus d'heures que prévu.
 * Recalcule hours_actual automatiquement si actual_start/end/break_minutes sont donnés.
 */
export async function editEntryHours(formData: FormData) {
  const s = createClient()
  const entry_id = formData.get('entry_id') as string
  if (!entry_id) return

  // Normalise les heures sous format HH:MM (le navigateur peut renvoyer HH:MM:SS)
  const normTime = (v: string | null) => {
    if (!v) return null
    const parts = v.split(':')
    return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : v
  }
  const actual_start = normTime((formData.get('actual_start') as string) || null)
  const actual_end = normTime((formData.get('actual_end') as string) || null)
  const breakRaw = formData.get('break_minutes') as string | null
  let break_minutes = breakRaw != null && breakRaw !== '' ? Number(breakRaw) : null
  const hoursRaw = formData.get('hours_actual') as string | null
  const hours_actual_override = hoursRaw != null && hoursRaw !== '' ? Number(hoursRaw) : null
  const adjustment_reason = (formData.get('adjustment_reason') as string) || null
  const deductLunch = formData.get('deduct_lunch') === '1'

  // Si la case "déduire 1h pause déjeuner" est cochée, on garantit 60 min de pause minimum
  if (deductLunch) {
    break_minutes = Math.max(break_minutes ?? 0, 60)
  }

  // IMPORTANT : hours_actual est une colonne GENERATED en base — on ne peut pas l'écrire.
  // On ajuste donc start / end / break_minutes et la base recalcule automatiquement.
  //
  // Si l'admin veut fixer un total précis via "Heures nettes" :
  //   on garde actual_start, et on recalcule actual_end pour que
  //   (end - start) - break = heures_voulues
  const payload: any = { adjustment_reason }

  let computedHours: number | null = null

  if (actual_start && actual_end && break_minutes != null && !isNaN(break_minutes)) {
    // Mode "ajuster depuis start/end/break"
    const [sh, sm] = actual_start.split(':').map(Number)
    const [eh, em] = actual_end.split(':').map(Number)
    const diffMin = (eh * 60 + em) - (sh * 60 + sm) - break_minutes
    computedHours = Math.max(0, Math.round((diffMin / 60) * 100) / 100)
    payload.actual_start = actual_start
    payload.actual_end = actual_end
    payload.break_minutes = break_minutes
  } else if (hours_actual_override != null && !isNaN(hours_actual_override) && actual_start) {
    // Mode "fixer un total manuel" — on ajuste end_time pour atteindre ce total
    const targetHours = Math.max(0, hours_actual_override - (deductLunch ? 1 : 0))
    const brk = deductLunch ? 60 : (break_minutes ?? 60)
    const [sh, sm] = actual_start.split(':').map(Number)
    const totalMinNeeded = Math.round(targetHours * 60) + brk
    const endMin = sh * 60 + sm + totalMinNeeded
    const endH = Math.floor(endMin / 60)
    const endM = endMin % 60
    const newEnd = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
    payload.actual_start = actual_start
    payload.actual_end = newEnd
    payload.break_minutes = brk
    computedHours = targetHours
  }

  const { error } = await s.from('time_entries').update(payload).eq('id', entry_id)
  if (error) {
    console.error('[editEntryHours] erreur SQL', error)
    redirect('/validation?toast=' + encodeURIComponent('Erreur : ' + error.message) + '&toast_type=error')
  }
  revalidatePath('/validation', 'page')
  revalidatePath('/dashboard')
  const return_to = (formData.get('return_to') as string) || '/validation'
  const msg = computedHours != null
    ? `Saisie mise à jour : ${Math.floor(computedHours)}h${String(Math.round((computedHours % 1) * 60)).padStart(2, '0')}`
    : 'Saisie mise à jour.'
  const sep = return_to.includes('?') ? '&' : '?'
  redirect(return_to + sep + 'toast=' + encodeURIComponent(msg))
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
 redirect('/validation?toast=' + encodeURIComponent('CFA mis à jour sur la saisie.'))
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
 const return_to = (formData.get('return_to') as string) || '/dashboard'
 const sep = return_to.includes('?') ? '&' : '?'
 redirect(return_to + sep + 'toast=' + encodeURIComponent('Saisie dévalidée. Elle retourne en file d\'attente.') + '&toast_type=info')
}

/**
 * Permet au formateur de supprimer une séance qu'il a lui-même déclarée en se trompant.
 * - Si la séance est "self_declared" (déclarée hors planning) : on supprime la séance ET la saisie
 * - Sinon (séance issue d'une mission planifiée) : on supprime uniquement la time_entry ;
 *   la séance planifiée reste pour que le formateur puisse re-saisir correctement.
 * - Impossible de supprimer une saisie déjà validée (il faut passer par l'admin pour dévalider).
 */
export async function deleteMyEntry(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return
  const { data: trainer } = await s.from('trainers').select('id').eq('user_id', user.id).single()
  if (!trainer) return

  const session_id = formData.get('session_id') as string
  if (!session_id) return

  const { data: session } = await s.from('mission_sessions')
    .select('id, trainer_id, self_declared, time_entries(id, status)')
    .eq('id', session_id).single()
  if (!session || session.trainer_id !== trainer.id) return

  const te: any = Array.isArray(session.time_entries) ? session.time_entries[0] : null
  if (te?.status === 'validated') {
    redirect('/sessions?toast=' + encodeURIComponent('Cette saisie est validée. Demandez à l\'admin de la dévalider avant de supprimer.') + '&toast_type=error')
  }

  // Supprime la time_entry si elle existe
  if (te?.id) await s.from('time_entries').delete().eq('id', te.id)

  // Si la séance est hors planning, on la supprime aussi
  if ((session as any).self_declared) {
    await s.from('session_documents').delete().eq('session_id', session_id)
    await s.from('mission_sessions').delete().eq('id', session_id)
    revalidatePath('/sessions')
    redirect('/sessions?toast=' + encodeURIComponent('Séance supprimée.') + '&toast_type=info')
  }

  revalidatePath('/sessions')
  redirect(`/sessions/${session_id}?toast=` + encodeURIComponent('Saisie supprimée. La séance reste au planning pour une nouvelle saisie.') + '&toast_type=info')
}

export async function refuseEntry(formData: FormData) {
 const s = createClient()
 const entry_id = formData.get('entry_id') as string
 const motif = (formData.get('motif') as string) || 'Non précisé'
 await s.from('time_entries').update({ status: 'refused', admin_comment: motif }).eq('id', entry_id)
 revalidatePath('/validation')
 redirect('/validation?toast=' + encodeURIComponent('Saisie refusée. Le formateur en est informé.') + '&toast_type=info')
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
 // Mission : laissée à l'admin (plus demandée au formateur dans l'UI)
 const mission_id = (formData.get('mission_id') as string) || null
 const formation_id = (formData.get('formation_id') as string) || null
 const declared_class_label = (formData.get('declared_class_label') as string) || null
 const session_date = formData.get('session_date') as string
 const start_time = formData.get('start_time') as string
 const end_time = formData.get('end_time') as string
 const break_minutes = Number(formData.get('break_minutes') ?? 60)
 const room = (formData.get('room') as string) || null

 if (!cfa_id || !session_date || !start_time || !end_time) return
 // Classe/formation obligatoire : soit une formation du référentiel, soit un texte libre
 if (!formation_id && !declared_class_label) return

 // 1. Créer la mission_session avec self_declared=true
 const { data: session, error: sessErr } = await s.from('mission_sessions').insert({
 cfa_id,
 mission_id,
 formation_id,
 declared_class_label,
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
 // Redirection vers la fiche de la nouvelle séance pour que le formateur puisse
 // téléverser ses supports pédagogiques si besoin.
 redirect(`/sessions/${session.id}?toast=` + encodeURIComponent('Séance déclarée. Vous pouvez attacher vos supports pédagogiques ci-dessous si besoin.'))
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
