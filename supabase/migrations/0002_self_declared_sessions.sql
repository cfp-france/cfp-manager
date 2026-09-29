-- =============================================================
-- Migration 0002 — Séances déclarées par le formateur (hors planning)
-- Permet au formateur de saisir une séance non planifiée initialement,
-- attachée à un CFA existant. L'admin valide et peut la rattacher à
-- une mission.
-- =============================================================

-- 1. mission_id devient nullable (session peut exister sans mission)
alter table public.mission_sessions alter column mission_id drop not null;

-- 2. Ajout des colonnes de traçabilité
alter table public.mission_sessions add column if not exists cfa_id uuid references public.cfa(id) on delete set null;
alter table public.mission_sessions add column if not exists self_declared boolean not null default false;
alter table public.mission_sessions add column if not exists declared_by_trainer_id uuid references public.trainers(id) on delete set null;

-- 3. Policy : le formateur peut INSERT ses propres déclarations
drop policy if exists p_sessions_insert_self_declared on public.mission_sessions;
create policy p_sessions_insert_self_declared on public.mission_sessions for insert
  with check (
    self_declared = true
    and declared_by_trainer_id = public.current_trainer_id()
    and trainer_id = public.current_trainer_id()
  );

-- 4. Policy : le formateur peut UPDATE sa propre déclaration (tant que non validée)
drop policy if exists p_sessions_update_own_declared on public.mission_sessions;
create policy p_sessions_update_own_declared on public.mission_sessions for update using (
  self_declared = true
  and declared_by_trainer_id = public.current_trainer_id()
) with check (
  self_declared = true
  and declared_by_trainer_id = public.current_trainer_id()
);

-- 5. Vérification : afficher les nouvelles colonnes
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'mission_sessions'
  and column_name in ('mission_id', 'cfa_id', 'self_declared', 'declared_by_trainer_id')
order by column_name;
