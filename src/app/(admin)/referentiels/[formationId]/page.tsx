import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { updateFormation, createBlock, updateBlock, deleteBlock } from '@/actions/referentiel'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function FormationEditPage({ params }: { params: { formationId: string } }) {
  const s = createClient()
  const { data: formation } = await s.from('formations')
    .select('id, code, name, description')
    .eq('id', params.formationId).single()

  if (!formation) notFound()

  const { data: blocks } = await s.from('competence_blocks')
    .select('id, number, title, skills(id)')
    .eq('formation_id', formation.id)
    .order('number')

  return (
    <div>
      <PageHeader
        title={formation.name}
        subtitle="Éditez la formation et gérez ses matières (blocs de compétences)."
        actions={<Link href="/referentiels" className="btn btn-outline">← Retour</Link>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card">
          <div className="card-header"><div className="card-title">Détails de la formation</div></div>
          <form action={updateFormation} className="card-body space-y-3">
            <input type="hidden" name="id" value={formation.id} />
            <div className="field">
              <label>Code court *</label>
              <input name="code" required defaultValue={formation.code} pattern="[A-Za-z0-9_]+" />
            </div>
            <div className="field">
              <label>Nom complet *</label>
              <input name="name" required defaultValue={formation.name} />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea name="description" rows={3} defaultValue={formation.description ?? ''} />
            </div>
            <button className="btn btn-primary w-full">💾 Enregistrer</button>
          </form>
        </div>

        <div className="lg:col-span-2 card">
          <div className="card-header"><div className="card-title">Matières / blocs de compétences</div></div>
          <div className="card-body space-y-2">
            {(blocks ?? []).map((b: any) => (
              <div key={b.id} className="border border-gray-200 rounded-md p-2 flex items-center gap-2 bg-white">
                <form action={updateBlock} className="flex items-center gap-2 flex-1">
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="formation_id" value={formation.id} />
                  <input name="number" type="number" defaultValue={b.number} min={1} className="w-16 text-sm border rounded px-2 py-1" />
                  <input name="title" defaultValue={b.title} className="flex-1 text-sm border rounded px-2 py-1" />
                  <button className="btn btn-sm btn-outline" title="Enregistrer">💾</button>
                </form>
                <Link href={`/referentiels/${formation.id}/${b.id}`} className="btn btn-sm btn-outline whitespace-nowrap">
                  {b.skills?.length ?? 0} compétence(s) →
                </Link>
                <form action={deleteBlock}>
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="formation_id" value={formation.id} />
                  <button className="btn btn-sm btn-danger" title="Supprimer la matière">🗑</button>
                </form>
              </div>
            ))}
            {(!blocks || blocks.length === 0) && (
              <div className="text-center text-gray-500 py-6 text-sm">Aucune matière définie pour cette formation.</div>
            )}

            <form action={createBlock} className="flex items-center gap-2 bg-brand-light rounded-md p-2 mt-3">
              <input type="hidden" name="formation_id" value={formation.id} />
              <input name="number" type="number" placeholder="N°" required min={1} className="w-16 text-sm border rounded px-2 py-1" />
              <input name="title" placeholder="Intitulé de la matière (CEJM, ADOC, Négociation vente…)" required className="flex-1 text-sm border rounded px-2 py-1" />
              <button className="btn btn-sm btn-primary">+ Ajouter</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
