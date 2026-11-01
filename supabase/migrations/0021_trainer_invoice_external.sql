-- =============================================================
-- Migration 0021 — Facture formateur externe (hors plateforme)
-- Permet à l'admin d'enregistrer une facture reçue en papier/mail
-- d'un formateur qui n'est pas passé par la génération auto.
-- =============================================================

alter table public.trainer_invoices
  add column if not exists external_source boolean not null default false;

comment on column public.trainer_invoices.external_source is
  'true si la facture a été reçue hors plateforme et saisie manuellement par l''admin';
