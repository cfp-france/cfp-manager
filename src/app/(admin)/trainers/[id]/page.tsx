import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { updateTrainer, toggleTrainerActive, unlinkTrainerFromUser, linkTrainerToUser } from '@/actions/referentials'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function EditTrainerPage({ params }: { params: { id: string } }) {
  const s = createClient()
  const { data: trainer } = await s.from('trainers').select('*, profile:profiles(email)').eq('id', params.id).single()
  if (!trainer) notFound()

  const { data: profiles } = await s.from('profiles').select('id, email, role').eq('role', 'trainer')

  return (
    <div>
      <PageHeader
        title={`Modifier ${trainer.first_name} ${trainer.last_name}`}
        subtitle={trainer.active ? `Actif · Créé le ${new Date(trainer.created_at).toLocaleDateString('fr-FR')}` : '⚠️ Formateur désactivé'}
        actions={<Link href="/trainers" className="btn btn-outline">← Retour à la liste</Link>}
      />

      <form action={updateTrainer} className="card mb-4">
        <input type="hidden" name="id" value={trainer.id} />
        <div className="card-header"><div className="card-title">👤 Identité & contact</div></div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="field"><label>Prénom *</label><input name="first_name" defaultValue={trainer.first_name} required /></div>
          <div className="field"><label>Nom *</label><input name="last_name" defaultValue={trainer.last_name} required /></div>
          <div className="field"><label>Email</label><input name="email" type="email" defaultValue={trainer.email ?? ''} /></div>
          <div className="field"><label>Téléphone</label><input name="phone" defaultValue={trainer.phone ?? ''} /></div>
          <div className="field md:col-span-2"><label>Spécialités (séparées par virgule)</label><input name="specialties" defaultValue={(trainer.specialties ?? []).join(', ')} /></div>
        </div>

        <div className="card-header border-t border-gray-200"><div className="card-title">🏢 Statut juridique & informations fiscales</div></div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="field">
            <label>Statut juridique</label>
            <select name="legal_status" defaultValue={trainer.legal_status ?? ''}>
              <option value="">— Choisir —</option>
              <option value="Auto-entrepreneur">Auto-entrepreneur / Micro-entreprise</option>
              <option value="EI">Entreprise individuelle (EI)</option>
              <option value="EURL">EURL</option>
              <option value="SASU">SASU</option>
              <option value="SARL">SARL</option>
              <option value="SAS">SAS</option>
              <option value="Portage salarial">Portage salarial</option>
              <option value="Autre">Autre</option>
            </select>
          </div>
          <div className="field"><label>Dénomination sociale</label><input name="company_name" defaultValue={trainer.company_name ?? ''} placeholder="Ex : Jean Dupont EI" /></div>
          <div className="field"><label>SIRET (14 chiffres)</label><input name="siret" defaultValue={trainer.siret ?? ''} pattern="[0-9 ]{14,20}" placeholder="123 456 789 01234" /></div>
          <div className="field"><label>Numéro NDA (Déclaration d'Activité)</label><input name="nda" defaultValue={trainer.nda ?? ''} placeholder="Ex : 11 75 12345 75" /></div>
          <div className="field"><label>N° TVA intracommunautaire</label><input name="vat_number" defaultValue={trainer.vat_number ?? ''} placeholder="FR12 123456789 — vide si franchise de TVA" /></div>
          <div className="field"><label>Tarif horaire par défaut (€ HT)</label><input name="hourly_rate_default" type="number" step="0.01" defaultValue={trainer.hourly_rate_default ?? ''} /></div>
          <div className="field md:col-span-2"><label>Adresse de facturation</label><textarea name="billing_address" rows={2} defaultValue={trainer.billing_address ?? ''} placeholder="Ex : 12 rue de la Paix, 75002 Paris" /></div>
        </div>

        <div className="card-header border-t border-gray-200"><div className="card-title">💳 Coordonnées bancaires (pour règlement des factures)</div></div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="field md:col-span-2"><label>IBAN</label><input name="iban" defaultValue={trainer.iban ?? ''} placeholder="FR76 1234 5678 9012 3456 7890 123" /></div>
          <div className="field"><label>BIC / SWIFT</label><input name="bic" defaultValue={trainer.bic ?? ''} placeholder="BNPAFRPP" /></div>
        </div>

        <div className="card-body border-t border-gray-200 flex items-center justify-between gap-2">
          <form action={toggleTrainerActive}>
            <input type="hidden" name="id" value={trainer.id} />
            <input type="hidden" name="activate" value={trainer.active ? '0' : '1'} />
            <button className={trainer.active ? 'btn btn-danger' : 'btn btn-success'}>
              {trainer.active ? '⏸ Désactiver' : '▶ Réactiver'}
            </button>
          </form>
          <div className="flex gap-2">
            <Link href="/trainers" className="btn btn-outline">Annuler</Link>
            <button type="submit" className="btn btn-primary">Enregistrer les modifications</button>
          </div>
        </div>
      </form>

      <div className="card">
        <div className="card-header"><div className="card-title">Compte de connexion lié</div></div>
        <div className="card-body">
          {trainer.user_id ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm">Compte lié : <b>{(trainer as any).profile?.email ?? trainer.user_id}</b></div>
                <div className="text-xs text-gray-500 mt-1">Ce formateur peut se connecter à son espace personnel.</div>
              </div>
              <form action={unlinkTrainerFromUser}>
                <input type="hidden" name="trainer_id" value={trainer.id} />
                <button className="btn btn-outline btn-sm">Délier ce compte</button>
              </form>
            </div>
          ) : (
            <form action={linkTrainerToUser} className="flex gap-2 items-end">
              <input type="hidden" name="trainer_id" value={trainer.id} />
              <div className="field flex-1">
                <label>Lier à un compte utilisateur existant</label>
                <select name="user_id" required>
                  <option value="">— Choisir un compte —</option>
                  {profiles?.map(p => <option key={p.id} value={p.id}>{p.email}</option>)}
                </select>
              </div>
              <button className="btn btn-primary">Lier</button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
