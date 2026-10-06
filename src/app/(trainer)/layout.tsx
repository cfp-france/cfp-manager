import { requireTrainer } from '@/lib/utils'
import { Sidebar } from '@/components/Sidebar'
import { createClient } from '@/lib/supabase/server'

export default async function TrainerLayout({ children }: { children: React.ReactNode }) {
  const { profile, trainer } = await requireTrainer()
  const s = createClient()
  let toSubmit = 0
  if (trainer?.id) {
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await s.from('mission_sessions')
      .select('id, time_entries(id, status)')
      .eq('trainer_id', trainer.id).lte('session_date', today)
    toSubmit = (data ?? []).filter((r: any) => !r.time_entries || r.time_entries.length === 0 || r.time_entries[0]?.status === 'draft').length
  }
  const sections = [
    { title: 'Mon espace', items: [
      { href: '/home', label: 'Accueil', icon: '🏠' },
      { href: '/sessions', label: 'Saisir mes séances', icon: '⏱', badge: toSubmit },
      { href: '/declare-session', label: 'Déclarer une séance', icon: '➕' },
      { href: '/earnings', label: 'Mes rémunérations', icon: '💰' },
      { href: '/absence', label: 'Déclarer une absence', icon: '🚫' },
      { href: '/profile', label: 'Mon profil', icon: '🪪' },
    ]},
  ]
  return (
    <div className="flex h-screen">
      <Sidebar role="trainer" sections={sections}
        userName={trainer ? `${trainer.first_name} ${trainer.last_name}` : (profile?.email ?? 'Formateur')}
        userSubtitle="Formateur indépendant" />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  )
}
