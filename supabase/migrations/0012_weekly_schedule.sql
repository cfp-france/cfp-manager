-- Planning hebdomadaire récurrent par CFA : grille de créneaux (jour × horaire)
-- Chaque case = un créneau de cours (formateur + matière) ou une pause déjeuner.

create table if not exists public.weekly_schedule_slots (
  id uuid primary key default gen_random_uuid(),
  cfa_id uuid not null references public.cfa(id) on delete cascade,
  weekday int not null check (weekday between 1 and 7),  -- 1=lundi, 7=dimanche
  start_time time not null,
  end_time time not null,
  kind text not null default 'lesson' check (kind in ('lesson','lunch_break','break','event')),
  trainer_id uuid references public.trainers(id) on delete set null,
  formation_id uuid references public.formations(id) on delete set null,
  block_id uuid references public.competence_blocks(id) on delete set null,
  room text,
  label text,     -- intitulé libre (événement, business game, etc.)
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ws_time_order check (end_time > start_time)
);

create index if not exists idx_ws_cfa on public.weekly_schedule_slots(cfa_id);
create index if not exists idx_ws_day on public.weekly_schedule_slots(cfa_id, weekday);

alter table public.weekly_schedule_slots enable row level security;

-- Admin/coordinateur gère tout. Formateur voit les créneaux où il est affecté.
drop policy if exists p_ws_select on public.weekly_schedule_slots;
create policy p_ws_select on public.weekly_schedule_slots for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
  or exists (select 1 from public.trainers t where t.id = trainer_id and t.user_id = auth.uid())
);
drop policy if exists p_ws_admin_all on public.weekly_schedule_slots;
create policy p_ws_admin_all on public.weekly_schedule_slots for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);
