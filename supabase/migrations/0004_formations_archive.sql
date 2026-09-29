-- Ajoute une colonne d'archivage sur les formations, pour permettre à l'admin
-- de désactiver une formation obsolète sans casser l'historique des missions.
alter table public.formations
  add column if not exists archived_at timestamptz;

-- Politique déjà couverte par les policies existantes sur formations.
