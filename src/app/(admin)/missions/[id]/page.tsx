import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { updateMission, archiveMission, unarchiveMission } from '@/actions/missions'
import { fmtDate, fmtHours } from '@/lib/utils'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function EditMissionPage({ params }: { params: { id: string } }) {
  const s = createClient()

  const [{ data: mission }, { data: cfas }, { data: formations }] = await Promise.all([
    s.from('missions')
      .select('*, cfa:cfa(name), mission_sessions(id, time_entries(id, status))')
      .eq('id', params.id).single(),
    s.from('cfa').select('id, name, city').is('archived_at', null).order('name'),
    s.from('formations').select('id, code, name').is('archived_at', null).order('name'),
  ])
  if (!mission) notFound()

  const nbSessions = mission.mission_sessions?.length ?? 0
  const nbValidated = (mission.mission_sessions ?? []).reduce((acc: number, se: any) =>
    acc + (se.time_entries?.some((te: any) => te.status === 'validated') ? 1 : 0), 0)

  return (
    <div>
      <PageHeader
        title={mission.name}
        subtitle={`${mission.cfa?.name} · ${fmtDate(mission.start_date)} → ${fmtDate(mission.end_date)} · ${nbSessions} séances (${nbValidated} validées)`}
        actions={<Link href="/missions" className="btn btn-outline">← Retour</Link>}
      />

      {mission.archived_at && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded mb-4 text-sm flex items-center justify-between">
          <span>⚠ Cette mission est archivée depuis le {fmtDate(mission.archived_at)}.</span>
          <form action={unarchiveMission}>
            <input type="hidden" name="id" value={mission.id} />
            <button className="btn btn-sm btn-outline">Désarchiver</button>
          </form>
        </div>
      )}

      <form action={updateMission} className="space-y-4">
        <input type="hidden" name="id" value={mission.id} />

        <div className="card">
          <div className="card-header"><div className="card-title">Informations principales</div></div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="field md:col-span-2">
              <label>Nom de la mission *</label>
              <input name="name" required defaultValue={mission.name} />
            </div>
            <div className="field">
              <label>CFA (client) *</label>
              <select name="cfa_id" required defaultValue={mission.cfa_id} className="font-medium">
                {(cfas ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}{c.city ? ` (${c.city})` : ''}</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                Si le formateur a saisi un mauvais CFA, corrigez-le ici — n'oubliez pas de cocher la case ci-dessous pour appliquer aux séances.
              </p>
            </div>
            <div className="field">
              <label>Formation</label>
              <select name="formation_id" defaultValue={mission.formation_id ?? ''}>
                <option value="">— Aucune —</option>
                {(formations ?? []).map((f: any) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Date début *</label>
              <input name="start_date" type="date" required defaultValue={mission.start_date} />
            </div>
            <div className="field">
              <label>Date fin *</label>
              <input name="end_date" type="date" required defaultValue={mission.end_date} />
            </div>
            <div className="field">
              <label>Tarif CFA (€ HT / h) *</label>
              <input name="cfa_hourly_rate" type="number" step="0.01" required defaultValue={mission.cfa_hourly_rate} />
            </div>
            <div className="field">
              <label>Tarif formateur (€ HT / h) *</label>
              <input name="trainer_hourly_rate" type="number" step="0.01" required defaultValue={mission.trainer_hourly_rate} />
            </div>
            <div className="field md:col-span-2">
              <label>Salle par défaut</label>
              <input name="default_room" defaultValue={mission.default_room ?? ''} />
            </div>
            <div className="field md:col-span-2">
              <label>Description / notes</label>
              <textarea name="description" rows={2} defaultValue={mission.description ?? ''} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Propagation du changement de CFA</div></div>
          <div className="card-body">
            <label className="flex items-start gap-2 cursor-pointer text-sm">
              <input type="checkbox" name="apply_to_sessions" value="1" defaultChecked className="mt-0.5" />
              <span>
                <b>Appliquer le CFA choisi à toutes les séances de la mission</b> (recommandé si vous le corrigez).
                Cela réassocie les {nbSessions} séances au bon CFA ; utile pour que la future facture CFA pointe au bon endroit.
                Les factures CFA déjà émises ne sont pas modifiées.
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-between items-center">
          {!mission.archived_at ? (
            <form action={archiveMission}>
              <input type="hidden" name="id" value={mission.id} />
              <button className="btn btn-danger">⏸ Archiver la mission</button>
            </form>
          ) : <span />}
          <div className="flex gap-2">
            <Link href="/missions" className="btn btn-outline">Annuler</Link>
            <button type="submit" className="btn btn-primary">💾 Enregistrer</button>
          </div>
        </div>
      </form>
    </div>
  )
}
