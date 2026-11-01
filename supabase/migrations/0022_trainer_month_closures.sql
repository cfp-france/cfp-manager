-- =============================================================
-- Migration 0022 — Clôtures mensuelles formateurs
-- Un formateur clôture son mois en fin de période pour indiquer
-- qu'il a saisi toutes ses heures. L'admin peut :
--  - voir que le mois est clôturé → OK pour facturer les CFA
--  - marquer le mois comme payé au formateur (règlement direct, hors plateforme)
--  - clôturer le mois à la place du formateur si besoin
-- =============================================================

create table if not exists public.trainer_month_closures (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  period_year int not null,
  period_month int not null check (period_month between 1 and 12),
  closed_at timestamptz not null default now(),
  closed_by uuid references auth.users(id),
  closed_by_admin boolean not null default false,
  total_hours numeric(10,2) not null default 0,
  total_amount_ht numeric(12,2) not null default 0,
  paid_at timestamptz,
  paid_by uuid references auth.users(id),
  payment_reference text,
  notes text,
  created_at timestamptz not null default now(),
  unique (trainer_id, period_year, period_month)
);

create index if not exists idx_tmc_trainer on public.trainer_month_closures(trainer_id);
create index if not exists idx_tmc_period on public.trainer_month_closures(period_year, period_month);

alter table public.trainer_month_closures enable row level security;

-- Formateur voit ses propres clôtures ; admin voit tout
drop policy if exists p_tmc_select on public.trainer_month_closures;
create policy p_tmc_select on public.trainer_month_closures for select using (
  exists (select 1 from public.trainers t where t.id = trainer_id and t.user_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);

-- Formateur peut clôturer son propre mois ; admin peut tout clôturer
drop policy if exists p_tmc_insert on public.trainer_month_closures;
create policy p_tmc_insert on public.trainer_month_closures for insert with check (
  exists (select 1 from public.trainers t where t.id = trainer_id and t.user_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);

-- Seul l'admin peut mettre à jour (marquer payé, rouvrir, etc.)
drop policy if exists p_tmc_update on public.trainer_month_closures;
create policy p_tmc_update on public.trainer_month_closures for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);

-- Seul l'admin peut supprimer (rouvrir une clôture)
drop policy if exists p_tmc_delete on public.trainer_month_closures;
create policy p_tmc_delete on public.trainer_month_closures for delete using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);
