import { PageHeader } from '@/components/PageHeader'
import { requireTrainer } from '@/lib/utils'
import { updateMyTrainerProfile } from '@/actions/trainer-profile'
import { DocumentsPanel } from '@/components/DocumentsPanel'

export const dynamic = 'force-dynamic'

export default async function TrainerProfilePage({ searchParams }: { searchParams: { saved?: string } }) {
  const { trainer } = await requireTrainer()

  if (!trainer) {
    return (
      <div>
        <PageHeader title="Mon profil" />
        <div className="card p-6 text-sm">Votre compte n'est pas encore lié à une fiche formateur. Contactez l'administration CFP.</div>
      </div>
    )
  }

  const t: any = trainer
  const incomplete = !t.siret || !t.nda || !t.iban

  return (
    <div>
      <PageHeader
        title="Mon profil"
        subtitle="Complétez vos informations juridiques et bancaires — elles seront utilisées lors de la génération de vos factures."
      />

      {searchParams.saved === '1' && (
        <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded mb-4 text-sm">
          ✓ Profil mis à jour.
        </div>
      )}
      {incomplete && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded mb-4 text-sm">
          ⚠ Votre profil est incomplet. Pour pouvoir générer vos factures, nous avons besoin au minimum de votre
          SIRET, NDA et IBAN.
        </div>
      )}

      <form action={updateMyTrainerProfile} className="space-y-4">
        <div className="card">
          <div className="card-header"><div className="card-title">👤 Identité & contact</div></div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="field"><label>Prénom *</label><input name="first_name" defaultValue={t.first_name} required /></div>
            <div className="field"><label>Nom *</label><input name="last_name" defaultValue={t.last_name} required /></div>
            <div className="field"><label>Email</label><input name="email" type="email" defaultValue={t.email ?? ''} /></div>
            <div className="field"><label>Téléphone</label><input name="phone" defaultValue={t.phone ?? ''} /></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">🏢 Statut juridique & informations fiscales</div></div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="field">
              <label>Statut juridique</label>
              <select name="legal_status" defaultValue={t.legal_status ?? ''}>
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
            <div className="field"><label>Dénomination sociale</label><input name="company_name" defaultValue={t.company_name ?? ''} /></div>
            <div className="field"><label>SIRET (14 chiffres)</label><input name="siret" defaultValue={t.siret ?? ''} placeholder="123 456 789 01234" /></div>
            <div className="field"><label>Numéro NDA (Déclaration d'Activité)</label><input name="nda" defaultValue={t.nda ?? ''} placeholder="Ex : 11 75 12345 75" /></div>
            <div className="field"><label>N° TVA intracommunautaire (facultatif)</label><input name="vat_number" defaultValue={t.vat_number ?? ''} placeholder="Vide si franchise de TVA" /></div>
            <div className="field md:col-span-2"><label>Adresse de facturation</label><textarea name="billing_address" rows={2} defaultValue={t.billing_address ?? ''} /></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">💳 Coordonnées bancaires</div></div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="field md:col-span-2"><label>IBAN</label><input name="iban" defaultValue={t.iban ?? ''} placeholder="FR76 1234 5678 9012 3456 7890 123" /></div>
            <div className="field"><label>BIC / SWIFT</label><input name="bic" defaultValue={t.bic ?? ''} /></div>
          </div>
        </div>

        <div className="flex justify-end">
          <button className="btn btn-primary">💾 Enregistrer mon profil</button>
        </div>
      </form>

      <div className="mt-5">
        {/* @ts-expect-error async server component */}
        <DocumentsPanel trainerId={t.id} />
      </div>
    </div>
  )
}
