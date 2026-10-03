-- Workflow : chaque nouveau compte créé via self-signup est en attente d'approbation
-- par un administrateur avant de pouvoir accéder aux fonctionnalités.

alter table public.profiles
  add column if not exists approval_status text not null default 'pending'
    check (approval_status in ('pending','approved','rejected'));

alter table public.profiles
  add column if not exists approved_at timestamptz;

alter table public.profiles
  add column if not exists approved_by uuid references auth.users(id);

alter table public.profiles
  add column if not exists rejection_reason text;

-- Les comptes existants (créés avant cette migration) sont considérés approuvés.
update public.profiles
  set approval_status = 'approved', approved_at = coalesce(approved_at, now())
  where approval_status = 'pending';

-- Policies : un utilisateur peut lire son propre profil (pour que la page /pending-approval marche).
-- Les admins peuvent lire tous les profils et les mettre à jour.
-- (Ces policies existent déjà en général ; les CREATE OR REPLACE ne cassent rien.)
