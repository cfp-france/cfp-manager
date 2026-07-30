import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { createMissionWithRecurrence } from '@/actions/missions'

export const dynamic = 'force-dynamic'

export default async function NewMissionPage() {
  const s = createClient()
  const [{ data: cfas }, { data: formations }, { data: trainers }] = await Promise.all([
    s.from('cfa').select('id, name').order('name'),
    s.from('formations').select('id, code, name').order('code'),
    s.from('trainers').select('id, first_name, last_name, hourly_rate_default').eq('active', true).order('last_name'),
  ])

  return (
    <div>
      <PageHeader title="Créer une mission" subtitle="Avec règle de récurrence : les séances sont générées automatiquement" />

      <form action={createMissionWithRecurrence} className="space-y-5">
        <div className="card">
          <div className="card-header"><div className="card-title">1. Cadre</div></div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="field"><label>Nom de la mission *</label><input name="name" required placeholder="Ex : NTC Promo 2 — Herblay" /></div>
            <div className="field"><label>CFA destinataire *</label>
              <select name="cfa_id" required>
                <option value="">— Choisir —</option>
                {cfas?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Formation</label>
              <select name="formation_id">
                <option value="">— Aucune —</option>
                {formations?.map(f => <option key={f.id} value={f.id}>{f.code} — {f.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Salle par défaut</label><input name="default_room" placeholder="Ex : Salle B12" /></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">2. Période & tarifs</div></div>
          <div className="card-body grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="field"><label>Début *</label><input name="start_date" type="date" required /></div>
            <div className="field"><label>Fin *</label><input name="end_date" type="date" required /></div>
            <div className="field"><label>Tarif CFA (€/h) *</label><input name="cfa_hourly_rate" type="number" step="0.01" required /></div>
            <div className="field"><label>Tarif formateur (€/h) *</label><input name="trainer_hourly_rate" type="number" step="0.01" required /></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">3. Récurrence & horaires</div></div>
          <div className="card-body space-y-4">
            <div>
              <label className="text-xs font-semibold text-navy">Jours de la semaine *</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {[['1','Lun'],['2','Mar'],['3','Mer'],['4','Jeu'],['5','Ven'],['6','Sam'],['0','Dim']].map(([v,l]) =>
                  <label key={v} className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-md px-3 py-1.5 cursor-pointer hover:bg-brand-light">
                    <input type="checkbox" name="weekdays" value={v} /> {l}
                  </label>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="field"><label>Heure début *</label><input name="start_time" type="time" defaultValue="09:00" required /></div>
              <div className="field"><label>Heure fin *</label><input name="end_time" type="time" defaultValue="17:00" required /></div>
              <div className="field"><label>Pause (min)</label><input name="break_minutes" type="number" defaultValue={60} /></div>
              <div className="field"><label>Formateur par défaut</label>
                <select name="default_trainer_id">
                  <option value="">— À affecter plus tard —</option>
                  {trainers?.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Dates à exclure (séparées par virgule, format YYYY-MM-DD)</label>
              <input name="exceptions" placeholder="2026-05-01, 2026-05-08" />
              <p className="text-[11px] text-gray-500 mt-1">Astuce : ajoutez ici les jours fériés et vacances scolaires.</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="reset" className="btn btn-outline">Réinitialiser</button>
          <button className="btn btn-primary">Créer la mission et générer les séances</button>
        </div>
      </form>
    </div>
  )
}
