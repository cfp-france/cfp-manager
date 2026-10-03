import { requireAdmin } from '@/lib/utils'
import { Sidebar } from '@/components/Sidebar'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin()
  const s = createClient()
  const [{ count: pending }, { count: absPending }, { count: subsPending }, { count: approvalsPending }] = await Promise.all([
    s.from('time_entries').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
    s.from('trainer_absences').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
    s.from('mission_sessions').select('*', { count: 'exact', head: true }).eq('needs_substitution', true),
    s.from('profiles').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
  ])

  const sections = [
    { title: 'Pilotage', items: [
      { href: '/dashboard', label: 'Tableau de bord', icon: '📊' },
    ]},
    { title: 'Référentiels', items: [
      { href: '/cfa', label: 'CFA / Écoles', icon: '🏫' },
      { href: '/trainers', label: 'Formateurs', icon: '👤' },
      { href: '/missions', label: 'Missions', icon: '📚' },
      { href: '/missions/new', label: 'Créer une mission', icon: '➕' },
      { href: '/referentiels', label: 'Formations / Matières', icon: '📖' },
    ]},
    { title: 'Opérations', items: [
      { href: '/approvals', label: 'Validation des comptes', icon: '🔐', badge: approvalsPending ?? 0 },
      { href: '/validation', label: 'Validation des heures', icon: '✅', badge: pending ?? 0 },
      { href: '/absences', label: 'Absences déclarées', icon: '🚫', badge: absPending ?? 0 },
      { href: '/substitutions', label: 'Remplacements', icon: '🔄', badge: subsPending ?? 0 },
      { href: '/pedagogy', label: 'Suivi pédagogique', icon: '🎓' },
    ]},
  ]

  return (
    <div className="flex h-screen">
      <Sidebar role="admin" sections={sections}
        userName={`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || (profile?.email ?? 'Admin')}
        userSubtitle="Administrateur CFP" />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1600px] mx-auto">{children}</div>
      </main>
    </div>
  )
}
