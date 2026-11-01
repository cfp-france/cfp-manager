-- =============================================================
-- Migration 0023 — Empêcher les séances en doublon
-- Garde-fou : interdit deux séances strictement identiques
-- (même formateur, même jour, mêmes horaires de début/fin).
-- Les séances "à pourvoir" (trainer_id NULL) ne sont pas concernées.
-- =============================================================

create unique index if not exists uniq_mission_sessions_trainer_slot
  on public.mission_sessions (trainer_id, session_date, start_time, end_time)
  where trainer_id is not null;
