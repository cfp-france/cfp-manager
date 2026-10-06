import { createClient } from '@/lib/supabase/server'
import { uploadMyDocument, deleteMyDocument } from '@/actions/documents'

const DOC_LABELS: Record<string, string> = {
  cv: '📄 CV',
  diplome: '🎓 Diplôme',
  kbis: '🏢 Kbis / Extrait registre',
  insee: '📋 Attestation INSEE (auto-entrepreneur)',
  inpi: '📋 Attestation INPI',
  rib: '💳 RIB',
  assurance: '🛡 Attestation d\'assurance RC Pro',
  autre: '📎 Autre document',
}

/**
 * Panneau documents affiché sur la page /profile du formateur
 * ET sur la page admin d'édition d'un formateur (readonly={true} pour admin).
 */
export async function DocumentsPanel({ trainerId, readOnly = false }: { trainerId: string; readOnly?: boolean }) {
  const s = createClient()
  const { data: docs } = await s.from('trainer_documents')
    .select('*').eq('trainer_id', trainerId).order('uploaded_at', { ascending: false })

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">📁 Mes documents</div>
          <div className="text-xs text-gray-500 mt-0.5">PDF, JPG, PNG ou Word — max 10 Mo par fichier.</div>
        </div>
      </div>
      <div className="card-body space-y-3">
        {!readOnly && (
          <form action={uploadMyDocument} encType="multipart/form-data" className="bg-brand-light/30 p-3 rounded-md flex flex-wrap items-end gap-2">
            <div className="field mb-0 flex-1 min-w-[180px]">
              <label className="text-[11px] font-semibold text-navy">Type de document</label>
              <select name="doc_type" required className="text-sm border rounded px-2 py-1 w-full">
                {Object.entries(DOC_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="field mb-0 flex-1 min-w-[180px]">
              <label className="text-[11px] font-semibold text-navy">Libellé (optionnel)</label>
              <input name="label" placeholder="Ex : Diplôme Master Marketing 2020" className="text-sm border rounded px-2 py-1 w-full" />
            </div>
            <div className="field mb-0 flex-1 min-w-[220px]">
              <label className="text-[11px] font-semibold text-navy">Fichier *</label>
              <input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="text-sm" />
            </div>
            <button className="btn btn-sm btn-primary">📤 Téléverser</button>
          </form>
        )}

        {(!docs || docs.length === 0) ? (
          <div className="text-center text-gray-500 py-4 text-sm">
            Aucun document téléversé.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {docs.map((d: any) => (
              <li key={d.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {DOC_LABELS[d.doc_type] ?? d.doc_type}
                    {d.label && d.label !== DOC_LABELS[d.doc_type] && <span className="text-gray-600 font-normal"> — {d.label}</span>}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Téléversé le {new Date(d.uploaded_at).toLocaleDateString('fr-FR')}
                    {d.size_bytes && ` · ${(d.size_bytes / 1024).toFixed(0)} Ko`}
                    {d.mime_type && ` · ${d.mime_type.split('/')[1]?.toUpperCase()}`}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <form action={async () => { 'use server'; const { getSignedDocUrl } = await import('@/actions/documents'); const url = await getSignedDocUrl(d.storage_path); if (url) { const { redirect } = await import('next/navigation'); redirect(url) } }}>
                    <button className="btn btn-sm btn-outline" title="Télécharger">⬇</button>
                  </form>
                  {!readOnly && (
                    <form action={deleteMyDocument}>
                      <input type="hidden" name="id" value={d.id} />
                      <button className="btn btn-sm btn-danger" title="Supprimer">🗑</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
