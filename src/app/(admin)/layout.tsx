import { requireAdmin } from '@/lib/utils'
import { Sidebar } from '@/components/Sidebar'
import { createClient } from '@/lib/supabase/server'
import { Toast } from '@/components/Toast'
import { Suspense } from 'react'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
 const { profile } = await requireAdmin()
 const s = createClient()
 const [{ count: pending }, { count: absPending }, { count: subsPending }, { count: approvalsPending }, { count: invoicesPending }] = await Promise.all([
 s.from('time_entries').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
 s.from('trainer_absences').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
 s.from('mission_sessions').select('*', { count: 'exact', head: true }).eq('needs_substitution', true),
 s.from('profiles').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
 s.from('trainer_invoices').select('*', { count: 'exact', head: true }).in('status', ['sent','draft']),
 ])

 const sections = [
 { title: 'Pilotage', items: [
 { href: '/dashboard', label: 'Tableau de bord' },
 { href: '/weekly-schedule', label: 'Planning récurrent (grille)' },
 { href: '/planning', label: 'Planning hebdo (vue séances)' },
 ]},
 { title: 'Référentiels', items: [
 { href: '/cfa', label: 'CFA / Écoles' },
 { href: '/trainers', label: 'Formateurs' },
 { href: '/missions', label: 'Missions' },
 { href: '/missions/new', label: 'Créer une mission' },
 { href: '/referentiels', label: 'Formations et matières' },
 ]},
 { title: 'Opérations', items: [
 { href: '/approvals', label: 'Validation des comptes', badge: approvalsPending ?? 0 },
 { href: '/validation', label: 'Validation des heures', badge: pending ?? 0 },
 { href: '/absences', label: 'Absences déclarées', badge: absPending ?? 0 },
 { href: '/substitutions', label: 'Remplacements', badge: subsPending ?? 0 },
 { href: '/pedagogy', label: 'Suivi pédagogique' },
 { href: '/invoicing', label: 'Facturation', badge: invoicesPending ?? 0 },
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
 <Suspense fallback={null}><Toast /></Suspense>
 </div>
 )
}
