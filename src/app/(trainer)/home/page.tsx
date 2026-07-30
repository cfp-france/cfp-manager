import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtHours, requireTrainer } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function TrainerHome() {
  const { trainer } = await requireTrainer()
  const s = createClient()

  if (!trainer) {
    return (
      <div>
        <PageHeader title="Bonjour 👋" />
        <div className="card p-8">
          <p className="text-sm">Votre compte n'est pas encore lié à une fiche formateur. Contactez l'administration CFP pour finaliser votre onboarding.</p>
        </div>
      </div>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const { data: sessions } = await s.from('mission_sessions')
    .select(`*, mission:missions(name, cfa:cfa(name)), time_entries(id, status, hours_actual)`)
    .eq('trainer_id', trainer.id).order('session_date').limit(20)

  const past = (sessions ?? []).filter((se: any) => se.session_date <= today)
  const upcoming = (sessions ?? []).filter((se: any) => se.session_date > today)

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const { data: validated } = await s.from('time_entries').select('hours_actual')
    .eq('trainer_id', trainer.id).eq('status', 'validated').gte('work_date', monthStart)
  const validatedHours = (validated ?? []).reduce((a, e: any) => a + Number(e.hours_actual ?? 0), 0)
  const earnings = validatedHours * Number(trainer.hourly_rate_default ?? 0)

  return (
    <div>
      <PageHeader title={`Bonjour ${trainer.first_name} 👋`}
        subtitle="Voici l'aperçu de votre activité en cours." />

      <div className="bg-gradient-to-br from-navy to-brand text-white rounded-xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><div className="text-2xl font-bold">{fmtHours(validatedHours)}</div><div className="text-xs opacity-80 uppercase tracking-wider">Heures validées ce mois</div></div>
          <div><div className="text-2xl font-bold">{earnings.toFixed(2)} €</div><div className="text-xs opacity-80 uppercase tracking-wider">Rémunération à facturer</div></div>
          <div><div className="text-2xl font-bold">{upcoming.length}</div><div className="text-xs opacity-80 uppercase tracking-wider">Séances à venir</div></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header"><div className="card-title">⚠️ Séances à saisir</div>
            <Link href="/sessions" className="text-xs text-brand font-semibold">Tout voir →</Link></div>
          <div className="card-body space-y-2">
            {past.filter((se: any) => !se.time_entries?.length || se.time_entries[0]?.status === 'draft').slice(0, 5).map((se: any) => (
              <div key={se.id} className="flex items-center gap-3 border border-gray-200 rounded-md p-3">
                <div className="bg-brand-light text-brand rounded-md px-3 py-1.5 text-center min-w-[54px]">
                  <div className="font-bold">{new Date(se.session_date).getDate()}</div>
                  <div className="text-[10px] uppercase">{new Date(se.session_date).toLocaleDateString('fr-FR', { month: 'short' })}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-navy text-sm truncate">{se.mission?.cfa?.name} — {se.mission?.name}</div>
                  <div className="text-xs text-gray-500">{se.start_time?.slice(0,5)}-{se.end_time?.slice(0,5)} · {se.room ?? '—'}</div>
                </div>
                <Link href={`/sessions/${se.id}`} className="btn btn-primary btn-sm">Saisir</Link>
              </div>
            ))}
            {past.filter((se: any) => !se.time_entries?.length).length === 0 && <p className="text-sm text-gray-500 text-center py-4">Aucune séance en attente 🎉</p>}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">📅 Prochaines séances</div></div>
          <div className="card-body space-y-2">
            {upcoming.slice(0, 5).map((se: any) => (
              <div key={se.id} className="flex items-center gap-3 border border-gray-200 rounded-md p-3">
                <div className="bg-brand-light text-brand rounded-md px-3 py-1.5 text-center min-w-[54px]">
                  <div className="font-bold">{new Date(se.session_date).getDate()}</div>
                  <div className="text-[10px] uppercase">{new Date(se.session_date).toLocaleDateString('fr-FR', { month: 'short' })}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-navy text-sm truncate">{se.mission?.cfa?.name} — {se.mission?.name}</div>
                  <div className="text-xs text-gray-500">{se.start_time?.slice(0,5)}-{se.end_time?.slice(0,5)} · {se.room ?? '—'}</div>
                </div>
              </div>
            ))}
            {upcoming.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Aucune séance planifiée</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
