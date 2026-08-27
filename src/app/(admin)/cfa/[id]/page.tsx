import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { updateCfa, archiveCfa, unarchiveCfa } from '@/actions/referentials'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function EditCfaPage({ params }: { params: { id: string } }) {
  const s = createClient()
  const { data: cfa } = await s.from('cfa').select('*').eq('id', params.id).single()
  if (!cfa) notFound()

  return (
    <div>
      <PageHeader
        title={`Modifier ${cfa.name}`}
        subtitle={cfa.archived_at ? '⚠️ Ce CFA est archivé' : `Créé le ${new Date(cfa.created_at).toLocaleDateString('fr-FR')}`}
        actions={<Link href="/cfa" className="btn btn-outline">← Retour à la liste</Link>}
      />

      <form action={updateCfa} className="card">
        <input type="hidden" name="id" value={cfa.id} />
        <div className="card-header"><div className="card-title">Informations du CFA</div></div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="field md:col-span-2">
            <label>Nom *</label>
            <input name="name" defaultValue={cfa.name} required />
          </div>
          <div className="field"><label>Ville</label><input name="city" defaultValue={cfa.city ?? ''} /></div>
          <div className="field"><label>SIRET</label><input name="siret" defaultValue={cfa.siret ?? ''} /></div>
          <div className="field md:col-span-2"><label>Adresse</label><input name="address" defaultValue={cfa.address ?? ''} /></div>
          <div className="field"><label>Email</label><input name="email" type="email" defaultValue={cfa.email ?? ''} /></div>
          <div className="field"><label>Téléphone</label><input name="phone" defaultValue={cfa.phone ?? ''} /></div>
          <div className="field"><label>Contact pédagogique</label><input name="pedagogic_contact" defaultValue={cfa.pedagogic_contact ?? ''} /></div>
          <div className="field"><label>Contact administratif</label><input name="admin_contact" defaultValue={cfa.admin_contact ?? ''} /></div>
          <div className="field md:col-span-2">
            <label>Notes internes / conditions de facturation</label>
            <textarea name="billing_notes" rows={3} defaultValue={cfa.billing_notes ?? ''} />
          </div>
        </div>
        <div className="card-body border-t border-gray-200 flex items-center justify-between gap-2">
          <div>
            {cfa.archived_at ? (
              <form action={unarchiveCfa}>
                <input type="hidden" name="id" value={cfa.id} />
                <button className="btn btn-outline">↩ Désarchiver</button>
              </form>
            ) : (
              <form action={archiveCfa}>
                <input type="hidden" name="id" value={cfa.id} />
                <button className="btn btn-danger">🗄 Archiver ce CFA</button>
              </form>
            )}
          </div>
          <div className="flex gap-2">
            <Link href="/cfa" className="btn btn-outline">Annuler</Link>
            <button type="submit" formAction={updateCfa} className="btn btn-primary">Enregistrer les modifications</button>
          </div>
        </div>
      </form>
    </div>
  )
}
