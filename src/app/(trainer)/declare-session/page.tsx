import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { requireTrainer } from '@/lib/utils'
import { declareSession } from '@/actions/entries'

export const dynamic = 'force-dynamic'

export default async function DeclareSessionPage() {
  const { trainer } = await requireTrainer()
  const s = createClient()

  const [{ data: cfas }, { data: missions }, { data: blocks }] = await Promise.all([
    s.from('cfa').select('id, name, city').is('archived_at', null).order('name'),
    s.from('missions').select('id, name, cfa_id, formation_id').is('archived_at', null).order('name'),
    s.from('competence_blocks').select('id, number, title, formation_id, skills(id, number, label)').order('number'),
  ])

  if (!trainer) {
    return (
      <div>
        <PageHeader title="Déclarer une séance" />
        <div className="card p-8"><p className="text-sm">Votre compte n'est pas encore lié à une fiche formateur. Contactez l'administration CFP.</p></div>
      </div>
    )
  }

  if (!cfas || cfas.length === 0) {
    return (
      <div>
        <PageHeader title="Déclarer une séance" />
        <div className="card p-8">
          <p className="text-sm">Aucun CFA n'est encore enregistré dans le système. Demandez à l'administration CFP de créer le CFA concerné avant de pouvoir déclarer une séance.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Déclarer une séance"
        subtitle="Pour une séance non planifiée initialement (remplacement de dernière minute, intervention ponctuelle...)"
      />

      <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded mb-5 text-sm">
        <b>Note :</b> cette déclaration sera envoyée à l'administration CFP pour validation. Vous pouvez déclarer uniquement pour un CFA déjà enregistré.
      </div>

      <form action={declareSession} className="space-y-5">
        <div className="card">
          <div className="card-header"><div className="card-title">① CFA et contexte</div></div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="field md:col-span-2">
              <label>CFA <span className="text-red-600">*</span></label>
              <select name="cfa_id" required>
                <option value="">— Choisir un CFA —</option>
                {cfas.map(c => <option key={c.id} value={c.id}>{c.name}{c.city ? ` (${c.city})` : ''}</option>)}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">Si le CFA n'apparaît pas, demandez à l'administration de le créer.</p>
            </div>
            <div className="field md:col-span-2">
              <label>Mission associée (optionnel)</label>
              <select name="mission_id">
                <option value="">— Aucune (l'admin l'attachera si besoin) —</option>
                {missions?.map(m => <option key={m.id} value={m.id} data-cfa={m.cfa_id}>{m.name}</option>)}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">Si votre séance faisait partie d'une mission existante, sélectionnez-la ici.</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">② Date et horaires</div></div>
          <div className="card-body grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="field md:col-span-4"><label>Date de la séance <span className="text-red-600">*</span></label><input name="session_date" type="date" required max={new Date().toISOString().slice(0, 10)} /></div>
            <div className="field"><label>Heure début *</label><input name="start_time" type="time" defaultValue="09:00" required /></div>
            <div className="field"><label>Heure fin *</label><input name="end_time" type="time" defaultValue="17:00" required /></div>
            <div className="field"><label>Pause (min)</label><input name="break_minutes" type="number" defaultValue={60} min={0} /></div>
            <div className="field"><label>Salle (optionnel)</label><input name="room" placeholder="Ex : Salle B12" /></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">③ Déroulé pédagogique (format CFP)</div>
              <div className="text-xs text-gray-500 mt-0.5">Renseignez ce que vous avez enseigné pendant cette séance.</div>
            </div>
          </div>
          <div className="card-body space-y-3">
            {blocks && blocks.length > 0 && (
              <>
                <div>
                  <label className="text-xs font-semibold text-navy">Bloc(s) de compétences ciblé(s)</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {blocks.map((b: any) => (
                      <label key={b.id} className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-md px-3 py-1.5 cursor-pointer hover:bg-brand-light">
                        <input type="checkbox" name="blocks" value={b.number} />
                        <span className="text-sm"><b>Bloc {b.number}</b> — {b.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-navy">Compétence(s) visée(s)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1 mt-1 max-h-64 overflow-y-auto border border-gray-200 rounded-md p-2">
                    {blocks.flatMap((b: any) => (b.skills ?? []).map((sk: any) => (
                      <label key={sk.id} className="flex items-start gap-2 p-1.5 hover:bg-brand-light rounded cursor-pointer text-xs">
                        <input type="checkbox" name="skills" value={sk.id} className="mt-0.5" />
                        <span><b>B{b.number}.{sk.number}</b> {sk.label}</span>
                      </label>
                    )))}
                  </div>
                </div>
              </>
            )}
            <div className="field"><label>Contenu abordé <span className="text-red-600">*</span></label>
              <textarea name="content_covered" rows={2} required placeholder="Détail des chapitres, sujets, cas pratiques" /></div>
            <div className="field"><label>Supports pédagogiques utilisés</label>
              <textarea name="pedagogical_supports" rows={2} placeholder="Ex : Diaporama, étude de cas, jeux de rôle, DST" /></div>
            <div className="field"><label>Travail effectué / Avancement</label>
              <textarea name="work_done" rows={3} placeholder="Simulations, jeux de rôle, analyse, correction…" /></div>
            <div className="field"><label>Commentaire / Points à revoir</label>
              <textarea name="points_to_review" rows={2} placeholder="Difficultés rencontrées, points à approfondir" /></div>
            <div className="field"><label>% de complétion du programme</label>
              <input name="program_completion" type="number" min={0} max={100} defaultValue={100} /></div>
            <div className="field"><label>Commentaire libre (contexte)</label>
              <textarea name="trainer_comment" rows={2} placeholder="Ex : remplacement de dernière minute, intervention ponctuelle…" /></div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button className="btn btn-primary">📤 Soumettre la déclaration pour validation</button>
        </div>
      </form>
    </div>
  )
}
