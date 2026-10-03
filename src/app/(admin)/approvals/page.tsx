import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { approveProfile, rejectProfile, revokeApproval } from '@/actions/approvals'
import { fmtDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ApprovalsPage() {
  const s = createClient()

  const [{ data: pending }, { data: others }] = await Promise.all([
    s.from('profiles').select('*').eq('approval_status', 'pending').order('created_at', { ascending: true }),
    s.from('profiles').select('*').in('approval_status', ['approved','rejected']).order('approved_at', { ascending: false }).limit(50),
  ])

  return (
    <div>
      <PageHeader
        title="Validation des comptes"
        subtitle="Approuvez ou refusez les nouveaux comptes créés par vos formateurs. Un compte en attente ne peut pas accéder à la plateforme."
      />

      <div className="card mb-5">
        <div className="card-header">
          <div className="card-title">⏳ Comptes en attente ({pending?.length ?? 0})</div>
        </div>
        <div className="card-body space-y-3">
          {(pending ?? []).map((p: any) => (
            <div key={p.id} className="border-l-4 border-amber-500 bg-amber-50 rounded p-3">
              <div className="flex justify-between items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-semibold">{p.email}</div>
                  <div className="text-xs text-gray-600">
                    Inscrit le {p.created_at ? fmtDate(p.created_at) : '—'}
                    {p.first_name && ` · ${p.first_name} ${p.last_name ?? ''}`}
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
                  <form action={approveProfile} className="flex gap-2 items-center">
                    <input type="hidden" name="profile_id" value={p.id} />
                    <select name="role" defaultValue="trainer" className="text-xs border rounded px-2 py-1">
                      <option value="trainer">Formateur</option>
                      <option value="coordinator">Coordinateur</option>
                      <option value="admin">Administrateur</option>
                    </select>
                    <button className="btn btn-sm btn-success">✓ Approuver</button>
                  </form>
                  <form action={rejectProfile} className="flex gap-2 items-center">
                    <input type="hidden" name="profile_id" value={p.id} />
                    <input name="reason" placeholder="Motif (optionnel)" className="text-xs border rounded px-2 py-1 w-40" />
                    <button className="btn btn-sm btn-danger">✗ Refuser</button>
                  </form>
                </div>
              </div>
            </div>
          ))}
          {(!pending || pending.length === 0) && (
            <div className="text-center text-gray-500 py-6 text-sm">
              🎉 Aucun compte en attente d'approbation.
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Historique des approbations récentes</div></div>
        <div className="card-body p-0">
          <table className="w-full">
            <thead><tr><th>Email</th><th>Rôle</th><th>Statut</th><th>Décidé le</th><th></th></tr></thead>
            <tbody>
              {(others ?? []).map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <div className="font-medium">{p.email}</div>
                    {p.first_name && <div className="text-xs text-gray-500">{p.first_name} {p.last_name}</div>}
                  </td>
                  <td className="text-xs">{p.role}</td>
                  <td>
                    {p.approval_status === 'approved'
                      ? <span className="status status-validated">Approuvé</span>
                      : <span className="status status-refused">Refusé</span>}
                    {p.rejection_reason && <div className="text-[11px] text-gray-500 italic mt-0.5">{p.rejection_reason}</div>}
                  </td>
                  <td className="text-xs">{p.approved_at ? fmtDate(p.approved_at) : '—'}</td>
                  <td>
                    <form action={revokeApproval}>
                      <input type="hidden" name="profile_id" value={p.id} />
                      <button className="btn btn-sm btn-outline" title="Remettre en attente">↺</button>
                    </form>
                  </td>
                </tr>
              ))}
              {(!others || others.length === 0) && (
                <tr><td colSpan={5} className="text-center text-gray-500 py-6">Aucun historique.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
