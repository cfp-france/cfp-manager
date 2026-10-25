-- Autoriser des tarifs NULL sur les missions pour permettre le fallback
-- sur le tarif par défaut du formateur / du CFA.
alter table public.missions alter column trainer_hourly_rate drop not null;
alter table public.missions alter column cfa_hourly_rate drop not null;
