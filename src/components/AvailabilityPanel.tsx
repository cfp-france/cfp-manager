import { createClient } from '@/lib/supabase/server'
import { fmtDate } from '@/lib/utils'

const WEEKDAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']

/**
 * Récap des disponibilités d'un formateur (lecture seule).
 * Utilisé sur la page admin d'édition du formateur et dans la vue mission.
 */
export async function AvailabilityPanel({ trainerId }: { trainerId: string }) {
  const s = createClient()
  const { data: all } = await s.from('trainer_availabilities')
    .select('*').eq('trainer_id', trainerId)

  const weekly = (all ?? []).filter((a: any) => a.kind === 'weekly')
    .sort((a: any, b: any) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time))
  const today = new Date().toISOString().slice(0, 10)
  const exceptional = (all ?? []).filter((a: any) => a.kind === 'exceptional' && a.specific_date >= today)
    .sort((a: any, b: any) => a.specific_date.localeCompare(b.specific_date))

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Disponibilités déclarées</div>
          <div className="text-xs text-gray-500 mt-0.5">Semaine type + créneaux ponctuels à venir.</div>
        </div>
      </div>
      <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-semibold text-navy mb-2 uppercase tracking-wider">Semaine type</div>
          {weekly.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Aucune disponibilité récurrente déclarée.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {weekly.map((a: any) => (
                <li key={a.id} className="flex gap-2">
                  <span className="font-semibold text-navy w-24">{WEEKDAYS[a.weekday]}</span>
                  <span>{a.start_time?.slice(0,5)} - {a.end_time?.slice(0,5)}</span>
                  {a.note && <span className="text-gray-500 italic">— {a.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="text-xs font-semibold text-navy mb-2 uppercase tracking-wider">Créneaux ponctuels à venir</div>
          {exceptional.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Aucun créneau ponctuel déclaré.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {exceptional.map((a: any) => (
                <li key={a.id} className="flex gap-2">
                  <span className="font-semibold text-navy w-28">{fmtDate(a.specific_date)}</span>
                  <span>{a.start_time?.slice(0,5)} - {a.end_time?.slice(0,5)}</span>
                  {a.note && <span className="text-gray-500 italic">— {a.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
