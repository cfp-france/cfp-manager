-- Demandes de suppression soumises par un formateur, validées (ou refusées) par un admin.
-- Scope : séances (mission_sessions) et missions (missions).

create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  target_type text not null check (target_type in ('session','mission')),
  target_id uuid not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_comment text,
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_deletion_requests_status on public.deletion_requests(status);
create index if not exists idx_deletion_requests_trainer on public.deletion_requests(trainer_id);
create index if not exists idx_deletion_requests_target on public.deletion_requests(target_type, target_id);

alter table public.deletion_requests enable row level security;

-- Un formateur voit et crée ses propres demandes
drop policy if exists trainer_select_own_deletion_requests on public.deletion_requests;
create policy trainer_select_own_deletion_requests on public.deletion_requests
  for select using (
    exists (select 1 from public.trainers t where t.id = trainer_id and t.user_id = auth.uid())
  );

drop policy if exists trainer_insert_own_deletion_requests on public.deletion_requests;
create policy trainer_insert_own_deletion_requests on public.deletion_requests
  for insert with check (
    exists (select 1 from public.trainers t where t.id = trainer_id and t.user_id = auth.uid())
  );

-- Un admin voit et modifie toutes les demandes
drop policy if exists admin_all_deletion_requests on public.deletion_requests;
create policy admin_all_deletion_requests on public.deletion_requests
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
