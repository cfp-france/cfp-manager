-- =============================================================
-- Migration 0030 — Promotion + matière obligatoires sur la saisie
-- Rend la promotion (classe) et la matière traçables au niveau de
-- chaque time_entry. Les factures CFA utilisent ces valeurs en priorité
-- (avant fallback mission/template/formation).
-- =============================================================

alter table public.time_entries
  add column if not exists promotion text,
  add column if not exists matiere text;

comment on column public.time_entries.promotion is
  'Promotion / classe concernée par la séance (ex: BTS_NDRC, NTC Promo 1)';
comment on column public.time_entries.matiere is
  'Matière enseignée (ex: Stratégie pro, Bloc 2)';
