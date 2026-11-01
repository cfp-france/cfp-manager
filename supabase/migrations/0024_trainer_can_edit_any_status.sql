-- =============================================================
-- Migration 0024 — Formateur peut modifier sa saisie quel que soit le statut
-- Avant : la RLS n'autorisait les updates par le formateur que si status ∈ ('draft','submitted'),
-- ce qui empêchait de corriger une saisie refusée ou validée (silencieusement, l'UI
-- affichait un bouton qui ne faisait rien).
-- Après : le formateur peut toujours modifier ses propres saisies. Toute modification
-- fait repasser le statut à 'submitted' (géré côté action submitTimeEntry) ou 'draft'.
-- =============================================================

drop policy if exists p_entries_update on public.time_entries;
create policy p_entries_update on public.time_entries for update using (
  public.is_admin()
  or trainer_id = public.current_trainer_id()
);
