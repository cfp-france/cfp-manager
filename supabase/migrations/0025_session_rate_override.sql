-- =============================================================
-- Migration 0025 — Tarifs horaires par séance (override)
-- Permet d'affecter un tarif formateur / CFA directement sur une
-- séance qui n'a pas de mission (séance auto-déclarée) ou pour
-- corriger ponctuellement sans toucher la mission entière.
-- NULL = pas d'override → on retombe sur le tarif de la mission.
-- =============================================================

alter table public.mission_sessions
  add column if not exists trainer_hourly_rate_override numeric(10,2),
  add column if not exists cfa_hourly_rate_override numeric(10,2);
