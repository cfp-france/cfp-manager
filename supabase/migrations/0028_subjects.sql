-- =============================================================
-- Migration 0028 — Référentiel 'subjects' (matières)
-- Alimente le datalist de saisie des matières sur les factures CFA.
-- Les nouvelles matières saisies manuellement s'ajoutent automatiquement
-- à ce référentiel pour les prochaines factures.
-- =============================================================

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists uniq_subjects_name_ci on public.subjects (lower(name));

alter table public.subjects enable row level security;

drop policy if exists p_subjects_select on public.subjects;
create policy p_subjects_select on public.subjects for select using (true);

drop policy if exists p_subjects_insert on public.subjects;
create policy p_subjects_insert on public.subjects for insert with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);

drop policy if exists p_subjects_update on public.subjects;
create policy p_subjects_update on public.subjects for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);

drop policy if exists p_subjects_delete on public.subjects;
create policy p_subjects_delete on public.subjects for delete using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);

-- Pré-remplir avec les matières les plus fréquentes
insert into public.subjects (name) values
  ('Négociation vente'), ('Stratégie pro'), ('Animation réseau'),
  ('Bloc 1'), ('Bloc 2'), ('Bloc 1 & 2'),
  ('CEJM'), ('Culture générale'), ('Anglais')
on conflict do nothing;
