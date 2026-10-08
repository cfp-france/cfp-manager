-- Tarif horaire CFA par défaut (utilisé pour les séances hors mission ou si la mission
-- n'a pas de tarif renseigné). Permet d'avoir un prix catalogue par client.

alter table public.cfa
  add column if not exists default_hourly_rate numeric(6,2);

comment on column public.cfa.default_hourly_rate is
  'Tarif horaire HT par défaut facturé à ce CFA quand une mission ne spécifie pas son propre tarif.';
