import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { createCfa } from '@/actions/referentials'

export const dynamic = 'force-dynamic'

export default async function CfaPage() {
  const s = createClient()
  const { data: rows } = await s.from('cfa').select('*').order('name')
  return (
    <div>
      <PageHeader title="CFA / Écoles partenaires" subtitle={`${rows?.length ?? 0} CFA enregistrés`} />

      <div className="card mb-6">
        <div className="card-header"><div className="card-title">➕ Ajouter un CFA</div></div>
        <form action={createCfa} className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="field md:col-span-2"><label>Nom *</label><input name="name" required /></div>
          <div className="field"><label>Ville</label><input name="city" /></div>
          <div className="field"><label>SIRET</label><input name="siret" /></div>
          <div className="field"><label>Email</label><input name="email" type="email" /></div>
          <div className="field"><label>Téléphone</label><input name="phone" /></div>
          <div className="field md:col-span-2"><label>Adresse</label><input name="address" /></div>
          <div className="field"><label>Contact pédagogique</label><input name="pedagogic_contact" /></div>
          <div className="field"><label>Contact administratif</label><input name="admin_contact" /></div>
          <div className="md:col-span-2"><button className="btn btn-primary">Créer le CFA</button></div>
        </form>
      </div>

      <div className="card">
        <table className="w-full">
          <thead><tr><th>Nom</th><th>Ville</th><th>Contact pédago</th><th>Email</th><th>Statut</th></tr></thead>
          <tbody>
            {rows?.map((r) => (
              <tr key={r.id}>
                <td className="font-semibold">{r.name}</td>
                <td>{r.city ?? '—'}</td>
                <td>{r.pedagogic_contact ?? '—'}</td>
                <td>{r.email ?? '—'}</td>
                <td>{r.archived_at ? <span className="status status-archived">Archivé</span> : <span className="status status-active">Actif</span>}</td>
              </tr>
            ))}
            {(!rows || rows.length === 0) && <tr><td colSpan={5} className="text-center text-gray-500 py-8">Aucun CFA. Créez-en un via le formulaire ci-dessus.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
