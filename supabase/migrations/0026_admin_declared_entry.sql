-- =============================================================
-- Migration 0026 — Saisies déclarées par l'admin
-- Permet à l'admin de déclarer une séance oubliée par un formateur,
-- avec possibilité de la valider directement.
-- Un flag indique au formateur qu'il doit compléter le déroulé pédagogique
-- si l'admin ne l'a pas fait lui-même.
-- =============================================================

alter table public.time_entries
  add column if not exists created_by_admin boolean not null default false,
  add column if not exists needs_trainer_pedagogy boolean not null default false;

comment on column public.time_entries.created_by_admin is
  'true si la saisie a été créée par l''administration à la place du formateur';
comment on column public.time_entries.needs_trainer_pedagogy is
  'true si l''admin a créé la saisie mais attend que le formateur complète le déroulé pédagogique';
