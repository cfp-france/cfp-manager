import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { adminDeclareSessionForTrainer } from '@/actions/entries'
import { PedagogyPicker } from '@/components/PedagogyPicker'
import { FormationClassPicker } from '@/components/FormationClassPicker'

export const dynamic = 'force-dynamic'

export default async function AdminDeclareSessionForTrainerPage({ searchParams }: { searchParams: { error?: string; toast?: string } }) {
 const s = createClient()

 const [{ data: trainers }, { data: cfas }, { data: missions }, { data: formationsRaw }] = await Promise.all([
  s.from('trainers').select('id, first_name, last_name, company_name').eq('active', true).is('archived_at', null).order('last_name'),
  s.from('cfa').select('id, name, city').is('archived_at', null).order('name'),
  s.from('missions').select('id, name, cfa_id, cfa:cfa(name)').is('archived_at', null).order('name'),
  s.from('formations').select('id, code, name, competence_blocks(id, number, title, skills(id, number, label))').is('archived_at', null).order('name'),
 ])

 const formations = (formationsRaw ?? []).map((f: any) => ({
  id: f.id, code: f.code, name: f.name,
  blocks: (f.competence_blocks ?? [])
   .sort((a: any, b: any) => a.number - b.number)
   .map((b: any) => ({
    id: b.id, number: b.number, title: b.title,
    skills: (b.skills ?? []).sort((a: any, b: any) => a.number - b.number),
   })),
 }))

 return (
  <div>
   <PageHeader
    title="Déclarer une séance pour un formateur"
    subtitle="Pour une séance oubliée. Vous pouvez la valider directement, ou laisser le formateur compléter le déroulé pédagogique."
   />

   {searchParams.error && (
    <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded mb-4 text-sm">Erreur : {searchParams.error}</div>
   )}
   {searchParams.toast && (
    <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded mb-4 text-sm">✓ {searchParams.toast}</div>
   )}

   <form action={adminDeclareSessionForTrainer} className="space-y-5">

    <div className="card">
     <div className="card-header"><div className="card-title">① Formateur et CFA</div></div>
     <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="field">
       <label>Formateur <span className="text-red-600">*</span></label>
       <select name="trainer_id" required>
        <option value="">— Choisir un formateur —</option>
        {(trainers ?? []).map((t: any) => (
         <option key={t.id} value={t.id}>{t.company_name || `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim()}</option>
        ))}
       </select>
      </div>
      <div className="field">
       <label>CFA <span className="text-red-600">*</span></label>
       <select name="cfa_id" required>
        <option value="">— Choisir un CFA —</option>
        {(cfas ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.city ? ` (${c.city})` : ''}</option>)}
       </select>
      </div>
      <div className="field md:col-span-2">
       <label>Mission (optionnel)</label>
       <select name="mission_id">
        <option value="">— Aucune mission (classe/formation ponctuelle) —</option>
        {(missions ?? []).map((m: any) => <option key={m.id} value={m.id}>{m.name} — {m.cfa?.name}</option>)}
       </select>
       <p className="text-[11px] text-gray-500 mt-1">Si vous ne reliez à aucune mission, saisissez la formation / classe ci-dessous.</p>
      </div>
      <div className="md:col-span-2">
       <FormationClassPicker formations={formations.map(f => ({ id: f.id, code: f.code, name: f.name }))} />
      </div>
     </div>
    </div>

    <div className="card">
     <div className="card-header"><div className="card-title">② Date et horaires</div></div>
     <div className="card-body grid grid-cols-1 md:grid-cols-4 gap-3">
      <div className="field md:col-span-4"><label>Date <span className="text-red-600">*</span></label><input name="session_date" type="date" required max={new Date().toISOString().slice(0, 10)} /></div>
      <div className="field"><label>Heure début *</label><input name="start_time" type="time" defaultValue="09:00" required /></div>
      <div className="field"><label>Heure fin *</label><input name="end_time" type="time" defaultValue="17:00" required /></div>
      <div className="field"><label>Pause (min)</label><input name="break_minutes" type="number" defaultValue={60} min={0} /></div>
      <div className="field"><label>Salle (optionnel)</label><input name="room" placeholder="Ex : Salle B12" /></div>
     </div>
    </div>

    <div className="card">
     <div className="card-header">
      <div>
       <div className="card-title">③ Déroulé pédagogique (optionnel)</div>
       <div className="text-xs text-gray-500 mt-0.5">
        <b>Si vous laissez vide</b>, le formateur sera invité à compléter lui-même le déroulé pédagogique.
        Vous pourrez suivre les déroulés non encore remplis depuis le menu <b>« Déroulés à compléter »</b>.
       </div>
      </div>
     </div>
     <div className="card-body space-y-3">
      <PedagogyPicker formations={formations} fixedFormationId={null} />
      <div className="field"><label>Contenu abordé</label>
       <textarea name="content_covered" rows={2} placeholder="Détail des chapitres, sujets, cas pratiques" /></div>
      <div className="field"><label>Supports pédagogiques utilisés (description)</label>
       <textarea name="pedagogical_supports" rows={2} placeholder="Ex : Diaporama, étude de cas, jeux de rôle, DST" /></div>
      <div className="field"><label>Travail effectué / Avancement</label>
       <textarea name="work_done" rows={3} /></div>
      <div className="field"><label>Commentaire / Points à revoir</label>
       <textarea name="points_to_review" rows={2} /></div>
     </div>
    </div>

    <div className="card bg-brand-light/30">
     <div className="card-body">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
       <input type="checkbox" name="validate_now" value="1" defaultChecked />
       <span>
        <b>Valider directement les heures</b> (pour pouvoir facturer immédiatement).
        Le formateur pourra toujours compléter le déroulé pédagogique après, la validation sera conservée.
       </span>
      </label>
     </div>
    </div>

    <div className="flex justify-end gap-2">
     <button className="btn btn-primary">Déclarer la séance</button>
    </div>
   </form>
  </div>
 )
}
