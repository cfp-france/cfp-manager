'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setMsg(null)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/'); router.refresh()
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg('Compte créé. Votre inscription doit être approuvée par un administrateur avant de pouvoir accéder à la plateforme.')
        setMode('login')
      }
    } catch (e: any) { setMsg(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy to-brand p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-navy text-white p-6 text-center">
          <div className="w-14 h-14 bg-white text-navy rounded-lg mx-auto grid place-items-center font-extrabold text-lg">CFP</div>
          <h1 className="mt-3 text-xl font-bold">CFP Manager</h1>
          <p className="text-sm opacity-80">Centre de Formation des Professionnels</p>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="flex gap-1 bg-brand-light rounded-lg p-1 mb-2">
            <button type="button" onClick={() => setMode('login')}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-md ${mode==='login'?'bg-navy text-white':'text-navy'}`}>Connexion</button>
            <button type="button" onClick={() => setMode('signup')}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-md ${mode==='signup'?'bg-navy text-white':'text-navy'}`}>Créer un compte</button>
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="field">
            <label>Mot de passe</label>
            <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode==='login'?'current-password':'new-password'} />
          </div>
          {msg && <div className="text-sm p-2 rounded bg-amber-50 text-amber-800 border-l-4 border-amber-500">{msg}</div>}
          <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center">
            {loading ? '…' : (mode==='login' ? 'Se connecter' : 'Créer mon compte')}
          </button>
          <p className="text-[11px] text-gray-500 text-center">
            {mode==='signup' ? 'Après inscription, votre compte doit être approuvé par un administrateur CFP avant utilisation.' : 'Contactez votre administrateur si vous ne pouvez pas vous connecter.'}
          </p>
        </form>
      </div>
    </div>
  )
}
