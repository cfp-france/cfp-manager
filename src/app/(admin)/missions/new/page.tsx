import { PageHeader } from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { createMissionWithRecurrence } from '@/actions/missions'

export const dynamic = 'force-dynamic'

const WEEKDAY_SHORT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']

export default async function NewMissionPage() {
 const s = createClient()
 const [{ data: cfas }, { data: formations }, { data: trainers }, { data: avails }] = await Promise.all([
 s.from('cfa').select('id, name').order('name'),
 s.from('formations').select('id, code, name').order('code'),
 s.from('trainers').select('id, first_name, last_name, hourly_rate_default').eq('active', true).order('last_name'),
 s.from('trainer_availabilities').select('trainer_id, weekday, start_time, end_time, kind').eq('kind', 'weekly'),
 ])

 // Récap des dispos par formateur (semaine type)
 const availByTrainer: Record<string, { weekday: number; start: string; end: string }[]> = {}
 for (const a of avails ?? []) {
 const tid = (a as any).trainer_id
 if (!availByTrainer[tid]) availByTrainer[tid] = []
 availByTrainer[tid].push({ weekday: (a as any).weekday, start: (a as any).start_time, end: (a as any).end_time })
 }
 for (const tid in availByTrainer) {
 availByTrainer[tid].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start))
 }

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

 {/* Récap des disponibilités déclarées (semaine type) */}
 <div className="bg-brand-light/30 border border-brand-light rounded-md p-3 mt-2">
 <div className="text-xs font-semibold text-navy uppercase tracking-wider mb-2">Disponibilités des formateurs (semaine type)</div>
 <div className="text-[11px] text-gray-600 mb-2">Pour vous aider à choisir le formateur et les jours. Les dispos ponctuelles sont visibles sur la fiche du formateur.</div>
 {(trainers ?? []).length === 0 ? (
 <p className="text-sm text-gray-500 italic">Aucun formateur actif.</p>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
 {trainers!.map(t => {
 const a = availByTrainer[t.id] ?? []
 return (
 <div key={t.id} className="bg-white rounded p-2 border border-gray-200">
 <div className="font-semibold text-navy">{t.first_name} {t.last_name}</div>
 {a.length === 0 ? (
 <div className="text-gray-500 italic">Pas de disponibilités déclarées</div>
 ) : (
 <ul className="mt-1">
 {a.map((av, i) => (
 <li key={i}>
 <span className="font-medium">{WEEKDAY_SHORT[av.weekday]}</span> : {av.start.slice(0,5)} - {av.end.slice(0,5)}
 </li>
 ))}
 </ul>
 )}
 </div>
 )
 })}
 </div>
 )}
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
