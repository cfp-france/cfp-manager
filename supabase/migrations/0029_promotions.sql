-- =============================================================
-- Migration 0029 — Référentiel 'promotions'
-- Alimente le datalist de saisie des promotions sur les factures CFA.
-- Les nouvelles promotions saisies manuellement s'ajoutent automatiquement.
-- =============================================================

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists uniq_promotions_name_ci on public.promotions (lower(name));

alter table public.promotions enable row level security;

drop policy if exists p_promotions_select on public.promotions;
create policy p_promotions_select on public.promotions for select using (true);

drop policy if exists p_promotions_insert on public.promotions;
create policy p_promotions_insert on public.promotions for insert with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);

drop policy if exists p_promotions_update on public.promotions;
create policy p_promotions_update on public.promotions for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);

drop policy if exists p_promotions_delete on public.promotions;
create policy p_promotions_delete on public.promotions for delete using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);

-- Pré-remplir avec les codes promotion déjà utilisés dans les factures existantes
insert into public.promotions (name)
select distinct promotion from public.cfa_invoice_lines
where promotion is not null and trim(promotion) <> ''
on conflict do nothing;

-- Pré-remplir aussi avec les codes formation du référentiel (NDRC, NTC, etc.)
insert into public.promotions (name)
select distinct code from public.formations where code is not null
on conflict do nothing;
