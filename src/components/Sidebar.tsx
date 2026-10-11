'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { logout } from '@/actions/auth'

type Item = { href: string; label: string; icon?: string; badge?: number | null }
type Section = { title: string; items: Item[] }

export function Sidebar({
 role, sections, userName, userSubtitle,
}: { role: 'admin' | 'trainer'; sections: Section[]; userName: string; userSubtitle: string }) {
 const path = usePathname()
 return (
 <aside className="w-60 bg-navy text-white flex flex-col shrink-0">
 <div className="p-5 border-b border-white/10 flex items-center gap-3">
 <div className="w-10 h-10 bg-white rounded-md grid place-items-center p-1">
 <Image src="/logo-cfp.png" alt="CFP" width={32} height={32} priority className="object-contain" />
 </div>
 <div>
 <div className="font-bold text-sm">CFP Manager</div>
 <div className="text-[10px] uppercase tracking-widest text-white/50">{role === 'admin' ? 'Administration' : 'Espace formateur'}</div>
 </div>
 </div>
 <nav className="flex-1 p-2 overflow-y-auto">
 {sections.map((s) => (
 <div key={s.title}>
 <div className="text-[10px] uppercase tracking-widest text-white/40 px-3 pt-3 pb-1 font-semibold">{s.title}</div>
 {s.items.map((it) => {
 const active = path === it.href || (it.href !== '/' && path.startsWith(it.href))
 return (
 <Link key={it.href} href={it.href}
 className={`flex items-center gap-3 px-3 py-2 rounded-md my-0.5 text-sm font-medium transition-colors ${active ? 'bg-brand text-white' : 'text-white/75 hover:bg-white/5 hover:text-white'}`}>
 <span className="flex-1 truncate">{it.label}</span>
 {typeof it.badge === 'number' && it.badge > 0 && (
 <span className="bg-accent text-white text-[10px] font-bold px-1.5 rounded-full">{it.badge}</span>
 )}
 </Link>
 )
 })}
 </div>
 ))}
 </nav>
 <div className="p-3 border-t border-white/10">
 <div className="flex items-center gap-3 mb-2">
 <div className="w-8 h-8 bg-brand rounded-full grid place-items-center text-xs font-bold">
 {userName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-sm font-semibold truncate">{userName}</div>
 <div className="text-[10px] text-white/50 truncate">{userSubtitle}</div>
 </div>
 </div>
 <form action={logout}>
 <button className="text-xs text-white/70 hover:text-white w-full text-left">Se déconnecter</button>
 </form>
 </div>
 </aside>
 )
}
