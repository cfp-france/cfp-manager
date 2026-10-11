'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Bandeau de notification. S'affiche en haut à droite pendant 4 secondes
 * quand le code place un message dans l'URL (?toast=... et &toast_type=...).
 * Chaque server action peut déclencher un toast en redirigeant vers une URL
 * contenant ?toast=Mon%20message&toast_type=success (ou error, info).
 */
export function Toast() {
 const router = useRouter()
 const params = useSearchParams()
 const message = params.get('toast')
 const type = (params.get('toast_type') || 'success') as 'success' | 'error' | 'info'
 const [visible, setVisible] = useState(false)

 useEffect(() => {
 if (!message) return
 setVisible(true)
 const t = setTimeout(() => {
 setVisible(false)
 // Nettoyer l'URL pour éviter que le toast revienne au rafraîchissement
 const p = new URLSearchParams(window.location.search)
 p.delete('toast'); p.delete('toast_type')
 const q = p.toString()
 router.replace(window.location.pathname + (q ? `?${q}` : ''))
 }, 4000)
 return () => clearTimeout(t)
 }, [message, router])

 if (!message || !visible) return null
 const bg = type === 'error' ? 'bg-red-600' : type === 'info' ? 'bg-blue-600' : 'bg-green-600'
 const icon = type === 'error' ? '!' : type === 'info' ? 'i' : 'v'
 return (
 <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
 <div className={`${bg} text-white rounded-lg shadow-xl px-5 py-3 flex items-center gap-3 min-w-[280px] max-w-md`}>
 <span className="font-bold text-lg bg-white/20 rounded-full w-7 h-7 flex items-center justify-center shrink-0">{icon}</span>
 <span className="text-sm font-medium">{message}</span>
 </div>
 </div>
 )
}
