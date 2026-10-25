-- Pour que le formateur puisse préciser la formation / classe lors d'une déclaration hors planning.
alter table public.mission_sessions
  add column if not exists formation_id uuid references public.formations(id) on delete set null,
  add column if not exists declared_class_label text;

create index if not exists idx_mission_sessions_formation on public.mission_sessions(formation_id);
