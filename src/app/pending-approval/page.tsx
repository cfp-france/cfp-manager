import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SignOutButton } from '@/components/SignOutButton'

export const dynamic = 'force-dynamic'

export default async function PendingApprovalPage({ searchParams }: { searchParams: { rejected?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  // Si déjà approuvé → page d'accueil
  if (profile?.approval_status === 'approved' || profile?.role === 'admin' || profile?.role === 'coordinator') {
    redirect('/')
  }

  const rejected = searchParams.rejected === '1' || profile?.approval_status === 'rejected'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy to-brand p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-navy text-white p-6 text-center">
          <div className="w-14 h-14 bg-white text-navy rounded-lg mx-auto grid place-items-center font-extrabold text-lg">CFP</div>
          <h1 className="mt-3 text-xl font-bold">CFP Manager</h1>
        </div>
        <div className="p-6 text-center space-y-4">
          {rejected ? (
            <>
              <div className="text-4xl">⛔</div>
              <h2 className="text-lg font-bold text-red-600">Accès refusé</h2>
              <p className="text-sm text-gray-700">
                Votre compte n'a pas été approuvé par l'administration CFP.
                {profile?.rejection_reason && (
                  <span className="block mt-2 bg-red-50 p-2 rounded text-red-800 text-xs italic">
                    Motif : {profile.rejection_reason}
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500">Contactez votre administrateur CFP pour plus d'informations.</p>
            </>
          ) : (
            <>
              <div className="text-4xl">⏳</div>
              <h2 className="text-lg font-bold text-navy">Compte en attente d'approbation</h2>
              <p className="text-sm text-gray-700">
                Votre inscription a bien été enregistrée. Un administrateur du CFP doit valider votre compte
                avant que vous puissiez accéder à la plateforme.
              </p>
              <p className="text-xs text-gray-500">
                Vous recevrez un accès complet dès que votre compte sera approuvé.<br/>
                Reconnectez-vous plus tard pour vérifier.
              </p>
            </>
          )}
          <div className="bg-gray-50 rounded-md p-3 text-xs text-gray-600">
            <div><b>Email :</b> {profile?.email ?? user.email}</div>
            <div><b>Statut :</b> {rejected ? 'Refusé' : 'En attente'}</div>
          </div>
          <SignOutButton />

        </div>
      </div>
    </div>
  )
}
