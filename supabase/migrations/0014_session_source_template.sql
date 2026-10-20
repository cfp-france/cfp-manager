-- Pour pouvoir distinguer, quand plusieurs créneaux récurrents coexistent sur la même plage horaire
-- (ex. deux formations en parallèle), lequel a été instancié, on garde la référence du créneau source.
alter table public.mission_sessions
  add column if not exists source_template_slot_id uuid references public.weekly_schedule_slots(id) on delete set null;

create index if not exists idx_mission_sessions_source_template
  on public.mission_sessions(source_template_slot_id);
