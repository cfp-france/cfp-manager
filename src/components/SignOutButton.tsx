'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function SignOutButton({ label = 'Se déconnecter' }: { label?: string }) {
  const router = useRouter()
  const supabase = createClient()
  async function doSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }
  return (
    <button onClick={doSignOut} className="btn btn-outline w-full">{label}</button>
  )
}
