'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

/**
 * Permet au formateur de corriger date, horaires, salle de SA séance.
 * Si une saisie liée était déjà validée, elle repasse automatiquement en 'submitted'
 * pour que l'admin la re-valide.
 */
export async function updateMySession(formData: FormData) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) redirect('/login')
  const { data: trainer } = await s.from('trainers').select('id').eq('user_id', user.id).single()
  if (!trainer) return

  const session_id = formData.get('session_id') as string
  if (!session_id) return

  // Vérifier que c'est bien la séance du formateur connecté
  const { data: session } = await s.from('mission_sessions')
    .select('id, trainer_id, time_entries(id, status)')
    .eq('id', session_id).single()
  if (!session || session.trainer_id !== trainer.id) return

  const session_date = formData.get('session_date') as string
  const start_time = formData.get('start_time') as string
  const end_time = formData.get('end_time') as string
  const room = (formData.get('room') as string) || null
  const break_minutes = Number(formData.get('break_minutes') ?? 60)

  await s.from('mission_sessions').update({
    session_date,
    start_time,
    end_time,
    room,
    break_minutes,
  }).eq('id', session_id)

  // Si une saisie validée existait → la remettre en attente pour que l'admin re-valide
  const te: any = Array.isArray(session.time_entries) ? session.time_entries[0] : null
  if (te?.id && te.status === 'validated') {
    await s.from('time_entries').update({ status: 'submitted', validated_at: null, validated_by: null })
      .eq('id', te.id)
  }

  revalidatePath(`/sessions/${session_id}`)
  revalidatePath('/sessions')
  redirect(`/sessions/${session_id}?toast=` + encodeURIComponent('Séance mise à jour. Pensez à soumettre votre saisie si ce n\'est pas déjà fait.'))
}
