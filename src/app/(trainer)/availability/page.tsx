import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { requireTrainer, fmtDate } from '@/lib/utils'
import { addWeeklyAvailability, addExceptionalAvailability, deleteAvailability } from '@/actions/availability'

export const dynamic = 'force-dynamic'

const WEEKDAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']

export default async function AvailabilityPage() {
  const { trainer } = await requireTrainer()
  if (!trainer) return <div className="card p-6 text-sm">Pas de fiche formateur liée.</div>
  const s = createClient()

  const { data: all } = await s.from('trainer_availabilities')
    .select('*').eq('trainer_id', trainer.id)
    .order('kind', { ascending: true })
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true })

  const weekly = (all ?? []).filter((a: any) => a.kind === 'weekly')
  const exceptional = (all ?? []).filter((a: any) => a.kind === 'exceptional')
    .sort((a: any, b: any) => a.specific_date.localeCompare(b.specific_date))

  return (
    <div>
      <PageHeader
        title="Mes disponibilités"
        subtitle="Indiquez vos créneaux habituels pour que l'administration CFP puisse construire les plannings en tenant compte de vos contraintes."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Semaine type (récurrent)</div>
              <div className="text-xs text-gray-500 mt-0.5">S'applique chaque semaine, sauf absences déclarées.</div>
            </div>
          </div>
          <div className="card-body space-y-3">
            <form action={addWeeklyAvailability} className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end bg-brand-light/30 p-2 rounded">
              <div className="field mb-0">
                <label className="text-[11px] font-semibold text-navy">Jour</label>
                <select name="weekday" required className="text-sm border rounded px-2 py-1 w-full">
                  {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
                </select>
              </div>
              <div className="field mb-0">
                <label className="text-[11px] font-semibold text-navy">De</label>
                <input name="start_time" type="time" required defaultValue="09:00" className="text-sm border rounded px-2 py-1 w-full" />
              </div>
              <div className="field mb-0">
                <label className="text-[11px] font-semibold text-navy">À</label>
                <input name="end_time" type="time" required defaultValue="17:00" className="text-sm border rounded px-2 py-1 w-full" />
              </div>
              <div className="field mb-0 col-span-2 md:col-span-1">
                <label className="text-[11px] font-semibold text-navy">Note (facultative)</label>
                <input name="note" placeholder="Ex : matinée uniquement" className="text-sm border rounded px-2 py-1 w-full" />
              </div>
              <button className="btn btn-sm btn-primary">Ajouter</button>
            </form>

            {weekly.length === 0 ? (
              <div className="text-center text-gray-500 py-4 text-sm">
                Aucune disponibilité récurrente. Ajoutez vos créneaux habituels.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr><th>Jour</th><th>Horaires</th><th>Note</th><th></th></tr>
                </thead>
                <tbody>
                  {weekly.map((a: any) => (
                    <tr key={a.id}>
                      <td className="font-semibold">{WEEKDAYS[a.weekday]}</td>
                      <td>{a.start_time?.slice(0,5)} - {a.end_time?.slice(0,5)}</td>
                      <td className="text-xs text-gray-500">{a.note ?? '—'}</td>
                      <td>
                        <form action={deleteAvailability}>
                          <input type="hidden" name="id" value={a.id} />
                          <button className="btn btn-sm btn-danger">Supprimer</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Disponibilités ponctuelles</div>
              <div className="text-xs text-gray-500 mt-0.5">En plus de votre semaine type : créneaux exceptionnels disponibles.</div>
            </div>
          </div>
          <div className="card-body space-y-3">
            <form action={addExceptionalAvailability} className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end bg-brand-light/30 p-2 rounded">
              <div className="field mb-0">
                <label className="text-[11px] font-semibold text-navy">Date</label>
                <input name="specific_date" type="date" required className="text-sm border rounded px-2 py-1 w-full" />
              </div>
              <div className="field mb-0">
                <label className="text-[11px] font-semibold text-navy">De</label>
                <input name="start_time" type="time" required defaultValue="09:00" className="text-sm border rounded px-2 py-1 w-full" />
              </div>
              <div className="field mb-0">
                <label className="text-[11px] font-semibold text-navy">À</label>
                <input name="end_time" type="time" required defaultValue="17:00" className="text-sm border rounded px-2 py-1 w-full" />
              </div>
              <div className="field mb-0 col-span-2 md:col-span-1">
                <label className="text-[11px] font-semibold text-navy">Note</label>
                <input name="note" placeholder="Facultatif" className="text-sm border rounded px-2 py-1 w-full" />
              </div>
              <button className="btn btn-sm btn-primary">Ajouter</button>
            </form>

            {exceptional.length === 0 ? (
              <div className="text-center text-gray-500 py-4 text-sm">
                Aucune disponibilité ponctuelle.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr><th>Date</th><th>Horaires</th><th>Note</th><th></th></tr>
                </thead>
                <tbody>
                  {exceptional.map((a: any) => (
                    <tr key={a.id}>
                      <td className="font-semibold">{fmtDate(a.specific_date)}</td>
                      <td>{a.start_time?.slice(0,5)} - {a.end_time?.slice(0,5)}</td>
                      <td className="text-xs text-gray-500">{a.note ?? '—'}</td>
                      <td>
                        <form action={deleteAvailability}>
                          <input type="hidden" name="id" value={a.id} />
                          <button className="btn btn-sm btn-danger">Supprimer</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
