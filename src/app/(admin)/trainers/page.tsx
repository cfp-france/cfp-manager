import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { createTrainer, linkTrainerToUser } from '@/actions/referentials'

export const dynamic = 'force-dynamic'

export default async function TrainersPage() {
  const s = createClient()
  const [{ data: trainers }, { data: profiles }] = await Promise.all([
    s.from('trainers').select('*').order('last_name'),
    s.from('profiles').select('id, email, role').eq('role', 'trainer'),
  ])
  return (
    <div>
      <PageHeader title="Formateurs" subtitle={`${trainers?.length ?? 0} formateurs enregistrés`} />

      <div className="card mb-6">
        <div className="card-header"><div className="card-title">➕ Ajouter un formateur</div></div>
        <form action={createTrainer} className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="field"><label>Prénom *</label><input name="first_name" required /></div>
          <div className="field"><label>Nom *</label><input name="last_name" required /></div>
          <div className="field"><label>Email</label><input name="email" type="email" /></div>
          <div className="field"><label>Téléphone</label><input name="phone" /></div>
          <div className="field"><label>SIRET</label><input name="siret" /></div>
          <div className="field"><label>NDA</label><input name="nda" /></div>
          <div className="field"><label>Tarif horaire par défaut (€)</label><input name="hourly_rate_default" type="number" step="0.01" /></div>
          <div className="field"><label>Spécialités (séparées par virgule)</label><input name="specialties" /></div>
          <div className="md:col-span-2"><button className="btn btn-primary">Créer le formateur</button></div>
        </form>
      </div>

      <div className="card">
        <table className="w-full">
          <thead><tr><th>Nom</th><th>Email</th><th>Spécialités</th><th>Tarif</th><th>Compte lié</th><th>Statut</th></tr></thead>
          <tbody>
            {trainers?.map((t) => (
              <tr key={t.id}>
                <td className="font-semibold">{t.first_name} {t.last_name}</td>
                <td>{t.email ?? '—'}</td>
                <td className="text-xs">{(t.specialties ?? []).join(', ') || '—'}</td>
                <td>{t.hourly_rate_default ? `${t.hourly_rate_default} €/h` : '—'}</td>
                <td>
                  {t.user_id ? <span className="status status-validated">Lié ✓</span> :
                    <form action={linkTrainerToUser} className="flex gap-1">
                      <input type="hidden" name="trainer_id" value={t.id} />
                      <select name="user_id" className="text-xs border rounded px-2 py-1">
                        <option value="">— Lier à un utilisateur —</option>
                        {profiles?.map(p => <option key={p.id} value={p.id}>{p.email}</option>)}
                      </select>
                      <button className="btn btn-sm btn-outline">Lier</button>
                    </form>}
                </td>
                <td>{t.active ? <span className="status status-active">Actif</span> : <span className="status status-archived">Inactif</span>}</td>
              </tr>
            ))}
            {(!trainers || trainers.length === 0) && <tr><td colSpan={6} className="text-center text-gray-500 py-8">Aucun formateur.</td></tr>}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        <b>Comment lier un formateur à un compte de connexion ?</b> 1) Le formateur crée son compte via l'écran de connexion (bouton « Créer un compte »).
        2) Ici, sélectionnez son email dans la liste déroulante et cliquez sur « Lier ».
      </p>
    </div>
  )
}
