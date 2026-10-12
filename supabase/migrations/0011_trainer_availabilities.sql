-- Disponibilités des formateurs : récurrentes (semaine type) ou ponctuelles.

create table if not exists public.trainer_availabilities (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  kind text not null check (kind in ('weekly','exceptional')),
  -- Pour kind='weekly' : weekday obligatoire (0=dimanche, 1=lundi, ..., 6=samedi)
  weekday int check (weekday between 0 and 6),
  -- Pour kind='exceptional' : date ponctuelle obligatoire
  specific_date date,
  start_time time not null,
  end_time time not null,
  note text,
  created_at timestamptz not null default now(),
  constraint av_kind_consistency check (
    (kind = 'weekly' and weekday is not null and specific_date is null)
    or (kind = 'exceptional' and specific_date is not null)
  )
);

create index if not exists idx_av_trainer on public.trainer_availabilities(trainer_id);
create index if not exists idx_av_date on public.trainer_availabilities(specific_date);

alter table public.trainer_availabilities enable row level security;

-- Formateur gère ses propres dispos ; admin voit tout
drop policy if exists p_av_select on public.trainer_availabilities;
create policy p_av_select on public.trainer_availabilities for select using (
  exists (select 1 from public.trainers t where t.id = trainer_id and t.user_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);
drop policy if exists p_av_insert on public.trainer_availabilities;
create policy p_av_insert on public.trainer_availabilities for insert with check (
  exists (select 1 from public.trainers t where t.id = trainer_id and t.user_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);
drop policy if exists p_av_update on public.trainer_availabilities;
create policy p_av_update on public.trainer_availabilities for update using (
  exists (select 1 from public.trainers t where t.id = trainer_id and t.user_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);
drop policy if exists p_av_delete on public.trainer_availabilities;
create policy p_av_delete on public.trainer_availabilities for delete using (
  exists (select 1 from public.trainers t where t.id = trainer_id and t.user_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);
