import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { createSkill, updateSkill, deleteSkill } from '@/actions/referentiel'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function BlockSkillsPage({ params }: { params: { formationId: string; blockId: string } }) {
  const s = createClient()
  const { data: block } = await s.from('competence_blocks')
    .select('id, number, title, formation:formations(id, name)')
    .eq('id', params.blockId).single()
  if (!block || (block.formation as any)?.id !== params.formationId) notFound()

  const { data: skills } = await s.from('skills')
    .select('id, number, label')
    .eq('block_id', block.id)
    .order('number')

  const formationName = (block.formation as any)?.name

  return (
    <div>
      <PageHeader
        title={`Bloc ${block.number} — ${block.title}`}
        subtitle={`Compétences pour ${formationName}`}
        actions={<Link href={`/referentiels/${params.formationId}`} className="btn btn-outline">← Retour à la formation</Link>}
      />

      <div className="card">
        <div className="card-header"><div className="card-title">Compétences ({skills?.length ?? 0})</div></div>
        <div className="card-body space-y-2">
          {(skills ?? []).map((sk: any) => (
            <div key={sk.id} className="border border-gray-200 rounded-md p-2 flex items-center gap-2 bg-white">
              <form action={updateSkill} className="flex items-center gap-2 flex-1">
                <input type="hidden" name="id" value={sk.id} />
                <input type="hidden" name="block_id" value={block.id} />
                <input type="hidden" name="formation_id" value={params.formationId} />
                <div className="text-xs font-mono text-gray-500 w-12">B{block.number}.</div>
                <input name="number" type="number" defaultValue={sk.number} min={1} className="w-16 text-sm border rounded px-2 py-1" />
                <input name="label" defaultValue={sk.label} className="flex-1 text-sm border rounded px-2 py-1" />
                <button className="btn btn-sm btn-outline" title="Enregistrer">💾</button>
              </form>
              <form action={deleteSkill}>
                <input type="hidden" name="id" value={sk.id} />
                <input type="hidden" name="block_id" value={block.id} />
                <input type="hidden" name="formation_id" value={params.formationId} />
                <button className="btn btn-sm btn-danger" title="Supprimer">🗑</button>
              </form>
            </div>
          ))}
          {(!skills || skills.length === 0) && (
            <div className="text-center text-gray-500 py-6 text-sm">Aucune compétence pour cette matière.</div>
          )}

          <form action={createSkill} className="flex items-center gap-2 bg-brand-light rounded-md p-2 mt-3">
            <input type="hidden" name="block_id" value={block.id} />
            <input type="hidden" name="formation_id" value={params.formationId} />
            <div className="text-xs font-mono text-gray-600 w-12">B{block.number}.</div>
            <input name="number" type="number" placeholder="N°" required min={1} className="w-16 text-sm border rounded px-2 py-1" />
            <input name="label" placeholder="Intitulé de la compétence" required className="flex-1 text-sm border rounded px-2 py-1" />
            <button className="btn btn-sm btn-primary">+ Ajouter</button>
          </form>
        </div>
      </div>
    </div>
  )
}
