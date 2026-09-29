import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { createFormation, archiveFormation, unarchiveFormation } from '@/actions/referentiel'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ReferentielsIndex() {
  const s = createClient()
  const { data: formations } = await s
    .from('formations')
    .select('id, code, name, description, archived_at, competence_blocks(id, skills(id))')
    .order('name')

  return (
    <div>
      <PageHeader
        title="Référentiels — Formations, matières et compétences"
        subtitle="Gérez ici le catalogue pédagogique du CFP. Les formateurs choisiront ces éléments lors de la saisie de leurs séances."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card">
          <div className="card-header"><div className="card-title">Formations</div></div>
          <div className="card-body p-0">
            <table className="w-full">
              <thead>
                <tr><th>Code</th><th>Nom</th><th>Matières</th><th>Compétences</th><th>Statut</th><th></th></tr>
              </thead>
              <tbody>
                {(formations ?? []).map((f: any) => {
                  const nbBlocks = f.competence_blocks?.length ?? 0
                  const nbSkills = (f.competence_blocks ?? []).reduce((acc: number, b: any) => acc + (b.skills?.length ?? 0), 0)
                  return (
                    <tr key={f.id}>
                      <td className="font-mono text-xs">{f.code}</td>
                      <td>
                        <Link href={`/referentiels/${f.id}`} className="font-semibold text-brand hover:underline">
                          {f.name}
                        </Link>
                        {f.description && <div className="text-xs text-gray-500">{f.description}</div>}
                      </td>
                      <td className="text-center">{nbBlocks}</td>
                      <td className="text-center">{nbSkills}</td>
                      <td>
                        {f.archived_at
                          ? <span className="status status-refused">Archivée</span>
                          : <span className="status status-validated">Active</span>}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <Link href={`/referentiels/${f.id}`} className="btn btn-sm btn-outline">Éditer</Link>
                          <form action={f.archived_at ? unarchiveFormation : archiveFormation}>
                            <input type="hidden" name="id" value={f.id} />
                            <button className="btn btn-sm btn-outline">{f.archived_at ? 'Restaurer' : 'Archiver'}</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {(!formations || formations.length === 0) && (
                  <tr><td colSpan={6} className="text-center text-gray-500 py-8">Aucune formation. Créez-en une avec le formulaire à droite.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">➕ Nouvelle formation</div></div>
          <form action={createFormation} className="card-body space-y-3">
            <div className="field">
              <label>Code court *</label>
              <input name="code" required placeholder="Ex : BTS_MCO" pattern="[A-Za-z0-9_]+" />
              <p className="text-[11px] text-gray-500 mt-1">Lettres, chiffres et « _ » uniquement.</p>
            </div>
            <div className="field">
              <label>Nom complet *</label>
              <input name="name" required placeholder="Ex : BTS Management Commercial Opérationnel" />
            </div>
            <div className="field">
              <label>Description (optionnel)</label>
              <textarea name="description" rows={2} placeholder="Notes internes, contexte…" />
            </div>
            <button className="btn btn-primary w-full">Créer la formation</button>
          </form>
        </div>
      </div>
    </div>
  )
}
