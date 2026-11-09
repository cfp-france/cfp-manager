-- =============================================================
-- Migration 0027 — Détail enrichi des lignes de facture CFA
-- Pour générer les factures au format demandé par le CFP :
-- DATE | FORMATEUR | NDA | HORAIRE | PROMOTION | MODULE | LIEU | TAUX/H | VOLUME | TOTAL
-- =============================================================

alter table public.cfa_invoice_lines
  add column if not exists trainer_nda text,
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists promotion text,
  add column if not exists module text,
  add column if not exists lieu text;

comment on column public.cfa_invoice_lines.trainer_nda is
  'NDA du formateur à la date de la facture (NULL si en cours d''acquisition)';
comment on column public.cfa_invoice_lines.promotion is
  'Promotion / classe (ex: REM, NTC, BTS NDRC)';
comment on column public.cfa_invoice_lines.module is
  'Module ou matière enseignée (ex: Stratégie pro, Bloc 1&2)';
comment on column public.cfa_invoice_lines.lieu is
  'Lieu de la formation (CFA / établissement)';
