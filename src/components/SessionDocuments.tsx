import { createClient } from '@/lib/supabase/server'
import { uploadSessionDocument, deleteSessionDocument, downloadSessionDocAction } from '@/actions/session-documents'

/**
 * Supports pédagogiques de la séance : cours, exercices, études de cas, DST, etc.
 * Affiché sur la page de saisie (côté formateur et admin).
 */
export async function SessionDocuments({ sessionId, readOnly = false, hideUpload = false }: { sessionId: string; readOnly?: boolean; hideUpload?: boolean }) {
  const s = createClient()
  const { data: docs } = await s.from('session_documents')
    .select('*').eq('session_id', sessionId).order('uploaded_at', { ascending: false })

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Supports pédagogiques déjà attachés</div>
          <div className="text-xs text-gray-500 mt-0.5">Cours, exercices, études de cas, DST, corrigés — max 20 Mo par fichier.</div>
        </div>
      </div>
      <div className="card-body space-y-3">
        {!readOnly && !hideUpload && (
          <form action={uploadSessionDocument} encType="multipart/form-data" className="bg-brand-light/30 p-3 rounded-md flex flex-wrap items-end gap-2">
            <input type="hidden" name="session_id" value={sessionId} />
            <div className="field mb-0 flex-1 min-w-[220px]">
              <label className="text-[11px] font-semibold text-navy">Libellé du support (optionnel)</label>
              <input name="label" placeholder="Ex : Diaporama CEJM — thème 1" className="text-sm border rounded px-2 py-1 w-full" />
            </div>
            <div className="field mb-0 flex-1 min-w-[220px]">
              <label className="text-[11px] font-semibold text-navy">Fichier</label>
              <input name="file" type="file" required accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp,.mp4" className="text-sm" />
            </div>
            <button className="btn btn-sm btn-primary">Téléverser</button>
          </form>
        )}

        {(!docs || docs.length === 0) ? (
          <div className="text-center text-gray-500 py-4 text-sm">Aucun support attaché pour cette séance.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {docs.map((d: any) => (
              <li key={d.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{d.label || 'Support'}</div>
                  <div className="text-[11px] text-gray-500">
                    Ajouté le {new Date(d.uploaded_at).toLocaleDateString('fr-FR')}
                    {d.size_bytes && ` · ${(d.size_bytes / 1024).toFixed(0)} Ko`}
                    {d.mime_type && ` · ${d.mime_type.split('/')[1]?.toUpperCase()}`}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <form action={downloadSessionDocAction}>
                    <input type="hidden" name="path" value={d.storage_path} />
                    <button className="btn btn-sm btn-outline" title="Télécharger">Télécharger</button>
                  </form>
                  {!readOnly && (
                    <form action={deleteSessionDocument}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="session_id" value={sessionId} />
                      <button className="btn btn-sm btn-danger" title="Supprimer">Supprimer</button>
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
