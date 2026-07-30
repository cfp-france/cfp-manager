-- =============================================================
-- CFP Manager — schéma initial + RLS + seed NTC
-- Exécuter dans l'éditeur SQL de Supabase (une seule fois).
-- =============================================================

-- Extensions utiles
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =============================================================
-- 1. ENUMS
-- =============================================================
create type user_role as enum ('admin', 'coordinator', 'trainer');
create type entry_status as enum ('draft', 'submitted', 'validated', 'refused', 'adjusted_by_admin');
create type absence_status as enum ('submitted', 'accepted', 'refused');
create type absence_reason as enum ('vacation', 'sickness', 'training', 'personal', 'other');
create type session_status as enum ('planned', 'cancelled', 'postponed', 'realized');
create type substitution_status as enum ('proposed', 'confirmed', 'refused', 'cancelled');
create type recurrence_type as enum ('weekly', 'biweekly', 'monthly_by_day', 'custom');

-- =============================================================
-- 2. TABLES DE RÉFÉRENCE
-- =============================================================

-- profiles étend auth.users (Supabase gère l'auth de base)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role user_role not null default 'trainer',
  first_name text,
  last_name text,
  email text unique,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CFA (clients)
create table public.cfa (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  city text,
  address text,
  phone text,
  email text,
  siret text,
  pedagogic_contact text,
  admin_contact text,
  billing_notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Formateurs (fiche métier — user_id est nullable pour permettre de créer une fiche avant l'invitation)
create table public.trainers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  siret text,
  nda text,
  hourly_rate_default numeric(6,2),
  specialties text[],
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Formations (ex : NTC, BTS MCO)
create table public.formations (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  name text not null,
  description text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

-- Blocs de compétences (rattachés à une formation)
create table public.competence_blocks (
  id uuid primary key default uuid_generate_v4(),
  formation_id uuid not null references public.formations(id) on delete cascade,
  number int not null,
  title text not null,
  created_at timestamptz not null default now(),
  unique (formation_id, number)
);

-- Compétences (rattachées à un bloc)
create table public.skills (
  id uuid primary key default uuid_generate_v4(),
  block_id uuid not null references public.competence_blocks(id) on delete cascade,
  number int not null,
  label text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (block_id, number)
);

-- =============================================================
-- 3. MISSIONS
-- =============================================================
create table public.missions (
  id uuid primary key default uuid_generate_v4(),
  cfa_id uuid not null references public.cfa(id) on delete restrict,
  formation_id uuid references public.formations(id) on delete set null,
  name text not null,
  description text,
  start_date date not null,
  end_date date not null,
  default_room text,
  cfa_hourly_rate numeric(6,2) not null,
  trainer_hourly_rate numeric(6,2) not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Règle de récurrence pour générer les séances d'une mission
create table public.session_recurrences (
  id uuid primary key default uuid_generate_v4(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  recurrence_type recurrence_type not null default 'weekly',
  weekdays int[] not null,
  start_time time not null,
  end_time time not null,
  break_minutes int not null default 60,
  start_date date not null,
  end_date date not null,
  exceptions date[] default '{}',
  default_room text,
  default_trainer_id uuid references public.trainers(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Séances individuelles (générées ou saisies manuellement)
create table public.mission_sessions (
  id uuid primary key default uuid_generate_v4(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  break_minutes int not null default 60,
  room text,
  trainer_id uuid references public.trainers(id) on delete set null,
  status session_status not null default 'planned',
  needs_substitution boolean not null default false,
  hours_planned numeric(5,2) generated always as (
    round(extract(epoch from (end_time - start_time)) / 3600.0 - (break_minutes / 60.0)::numeric, 2)
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_sessions_trainer on public.mission_sessions(trainer_id);
create index idx_sessions_date on public.mission_sessions(session_date);
create index idx_sessions_mission on public.mission_sessions(mission_id);

-- =============================================================
-- 4. SAISIE D'HEURES + PÉDAGOGIE
-- =============================================================
create table public.time_entries (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null unique references public.mission_sessions(id) on delete cascade,
  trainer_id uuid not null references public.trainers(id) on delete restrict,
  work_date date not null,

  -- Heures réelles
  actual_start time not null,
  actual_end time not null,
  break_minutes int not null default 60,
  hours_actual numeric(5,2) generated always as (
    round(extract(epoch from (actual_end - actual_start)) / 3600.0 - (break_minutes / 60.0)::numeric, 2)
  ) stored,
  adjustment_reason text,

  -- Pédagogie (format aligné CFP)
  competence_blocks_targeted int[] default '{}',
  skill_ids uuid[] default '{}',
  content_covered text,
  pedagogical_supports text,
  work_done text,
  points_to_review text,
  program_completion int check (program_completion between 0 and 100),

  -- Général
  trainer_comment text,
  admin_comment text,
  status entry_status not null default 'draft',
  validated_by uuid references public.profiles(id) on delete set null,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_entries_trainer on public.time_entries(trainer_id);
create index idx_entries_status on public.time_entries(status);
create index idx_entries_date on public.time_entries(work_date);

-- =============================================================
-- 5. ABSENCES & REMPLACEMENTS
-- =============================================================
create table public.trainer_absences (
  id uuid primary key default uuid_generate_v4(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason absence_reason not null,
  reason_detail text,
  status absence_status not null default 'submitted',
  affected_session_ids uuid[] default '{}',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.session_substitutions (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.mission_sessions(id) on delete cascade,
  original_trainer_id uuid references public.trainers(id) on delete set null,
  substitute_trainer_id uuid references public.trainers(id) on delete set null,
  reason text,
  status substitution_status not null default 'proposed',
  substitute_cfa_rate numeric(6,2),
  substitute_trainer_rate numeric(6,2),
  proposed_by uuid references public.profiles(id) on delete set null,
  confirmed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================
-- 6. TRIGGERS "updated_at"
-- =============================================================
create or replace function public.tg_touch_updated_at() returns trigger as $$
begin new.updated_at := now(); return new; end $$ language plpgsql;

do $$
declare t text;
begin
  for t in select unnest(array[
    'profiles','cfa','trainers','missions','mission_sessions',
    'time_entries','trainer_absences','session_substitutions'])
  loop
    execute format('drop trigger if exists trg_touch on public.%I', t);
    execute format('create trigger trg_touch before update on public.%I for each row execute function public.tg_touch_updated_at()', t);
  end loop;
end $$;

-- =============================================================
-- 7. HELPER : rôle du user courant
-- =============================================================
create or replace function public.current_user_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_trainer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select t.id from public.trainers t where t.user_id = auth.uid() limit 1
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()) in ('admin','coordinator'), false)
$$;

-- =============================================================
-- 8. RLS — activation + policies
-- =============================================================
alter table public.profiles enable row level security;
alter table public.cfa enable row level security;
alter table public.trainers enable row level security;
alter table public.formations enable row level security;
alter table public.competence_blocks enable row level security;
alter table public.skills enable row level security;
alter table public.missions enable row level security;
alter table public.session_recurrences enable row level security;
alter table public.mission_sessions enable row level security;
alter table public.time_entries enable row level security;
alter table public.trainer_absences enable row level security;
alter table public.session_substitutions enable row level security;

-- profiles : chacun voit son profil, admin voit tout
create policy p_profiles_self on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy p_profiles_update_self on public.profiles for update using (auth.uid() = id or public.is_admin());
create policy p_profiles_insert on public.profiles for insert with check (auth.uid() = id or public.is_admin());

-- CFA, trainers, formations, blocs, skills : admin en écriture, tous lecteurs authentifiés
create policy p_cfa_read on public.cfa for select using (auth.role() = 'authenticated');
create policy p_cfa_write on public.cfa for all using (public.is_admin()) with check (public.is_admin());

create policy p_trainers_read on public.trainers for select using (auth.role() = 'authenticated');
create policy p_trainers_write on public.trainers for all using (public.is_admin()) with check (public.is_admin());

create policy p_formations_read on public.formations for select using (auth.role() = 'authenticated');
create policy p_formations_write on public.formations for all using (public.is_admin()) with check (public.is_admin());

create policy p_blocks_read on public.competence_blocks for select using (auth.role() = 'authenticated');
create policy p_blocks_write on public.competence_blocks for all using (public.is_admin()) with check (public.is_admin());

create policy p_skills_read on public.skills for select using (auth.role() = 'authenticated');
create policy p_skills_write on public.skills for all using (public.is_admin()) with check (public.is_admin());

-- Missions : admin écrit, formateurs lisent celles où ils sont affectés (via sessions)
create policy p_missions_read on public.missions for select using (
  public.is_admin() or exists (
    select 1 from public.mission_sessions s
    where s.mission_id = missions.id and s.trainer_id = public.current_trainer_id()
  )
);
create policy p_missions_write on public.missions for all using (public.is_admin()) with check (public.is_admin());

-- Récurrences : admin uniquement
create policy p_rec_all on public.session_recurrences for all using (public.is_admin()) with check (public.is_admin());

-- Sessions : formateur ne voit que ses sessions, admin voit tout
create policy p_sessions_read on public.mission_sessions for select using (
  public.is_admin() or trainer_id = public.current_trainer_id()
);
create policy p_sessions_write on public.mission_sessions for all using (public.is_admin()) with check (public.is_admin());

-- time_entries : formateur voit/écrit les siennes, admin voit tout et peut modifier
create policy p_entries_read on public.time_entries for select using (
  public.is_admin() or trainer_id = public.current_trainer_id()
);
create policy p_entries_insert on public.time_entries for insert with check (
  public.is_admin() or trainer_id = public.current_trainer_id()
);
create policy p_entries_update on public.time_entries for update using (
  public.is_admin() or (trainer_id = public.current_trainer_id() and status in ('draft','submitted'))
);
create policy p_entries_delete on public.time_entries for delete using (public.is_admin());

-- Absences : formateur crée les siennes, admin traite tout
create policy p_abs_read on public.trainer_absences for select using (
  public.is_admin() or trainer_id = public.current_trainer_id()
);
create policy p_abs_insert on public.trainer_absences for insert with check (
  trainer_id = public.current_trainer_id()
);
create policy p_abs_update on public.trainer_absences for update using (
  public.is_admin() or (trainer_id = public.current_trainer_id() and status = 'submitted')
);

-- Remplacements : admin uniquement
create policy p_subs_all on public.session_substitutions for all using (public.is_admin()) with check (public.is_admin());

-- =============================================================
-- 9. TRIGGER : création automatique du profile à l'inscription
-- =============================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, role)
  values (new.id, new.email, 'trainer')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_new_user on auth.users;
create trigger trg_new_user after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- 10. SEED — Référentiel NTC + 1 promo Herblay
-- =============================================================
insert into public.formations(id, code, name, description) values
  ('a1000000-0000-0000-0000-000000000001', 'NTC', 'Négociateur Technico-Commercial',
   'Titre professionnel niveau 5 — 2 blocs de compétences');

insert into public.competence_blocks(id, formation_id, number, title) values
  ('b1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001',1,'Prospecter un secteur d''activité et organiser une activité commerciale'),
  ('b1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000001',2,'Conseiller, négocier et suivre une relation client');

insert into public.skills(block_id, number, label, description) values
  ('b1000000-0000-0000-0000-000000000001',1,'Maîtriser la communication interpersonnelle','Développer des compétences de communication pour interagir efficacement avec les clients, prospects, et collaborateurs.'),
  ('b1000000-0000-0000-0000-000000000001',2,'Réaliser une veille commerciale et identifier des opportunités','Collecter, analyser et exploiter des informations sur le marché et les concurrents.'),
  ('b1000000-0000-0000-0000-000000000001',3,'Segmenter le marché et identifier les clients potentiels','Définir et segmenter le marché cible pour prioriser les actions de prospection.'),
  ('b1000000-0000-0000-0000-000000000001',4,'Élaborer une stratégie de prospection','Développer une stratégie de prospection adaptée à un secteur d''activité et à un type de client.'),
  ('b1000000-0000-0000-0000-000000000001',5,'Gérer un portefeuille client','Organiser et suivre un portefeuille de clients ou prospects afin de maximiser les opportunités commerciales.'),
  ('b1000000-0000-0000-0000-000000000001',6,'Analyser les performances commerciales et ajuster la stratégie','Utiliser des indicateurs de performance (KPI) pour mesurer l''efficacité des actions commerciales.'),
  ('b1000000-0000-0000-0000-000000000001',7,'Synthèse et préparation au jury final','Consolider les compétences acquises et préparer une présentation devant un jury.'),
  ('b1000000-0000-0000-0000-000000000002',1,'Concevoir un argumentaire de vente','Structurer et présenter un argumentaire commercial adapté aux besoins spécifiques d''un client.'),
  ('b1000000-0000-0000-0000-000000000002',2,'Proposer une offre technique et commerciale adaptée','Construire une offre technique et commerciale répondant aux besoins du client.'),
  ('b1000000-0000-0000-0000-000000000002',3,'Réaliser une démonstration technique','Concevoir et réaliser une démonstration technique pour présenter efficacement un produit ou service.'),
  ('b1000000-0000-0000-0000-000000000002',4,'Négocier une offre technique et commerciale','Maîtriser les techniques de négociation pour finaliser une vente.'),
  ('b1000000-0000-0000-0000-000000000002',5,'Gérer la relation client et optimiser la satisfaction','Développer des techniques de gestion client pour fidéliser les clients et améliorer leur satisfaction.'),
  ('b1000000-0000-0000-0000-000000000002',6,'Concevoir un plan d''action commerciale','Élaborer un plan d''action détaillé pour atteindre les objectifs commerciaux.'),
  ('b1000000-0000-0000-0000-000000000002',7,'Gérer les actions commerciales en coordination avec les équipes','Coordonner les actions commerciales entre différentes équipes.'),
  ('b1000000-0000-0000-0000-000000000002',8,'Analyser la rentabilité des actions commerciales','Mesurer l''impact des actions commerciales sur la rentabilité de l''entreprise.'),
  ('b1000000-0000-0000-0000-000000000002',9,'Mener une action commerciale à distance','Utiliser des outils numériques pour réaliser des actions commerciales à distance.'),
  ('b1000000-0000-0000-0000-000000000002',10,'Synthèse et préparation au jury final','Consolider les compétences acquises du Bloc 2 et préparer une présentation devant un jury.');

-- CFA Herblay
insert into public.cfa(id, name, city, address, phone, email, pedagogic_contact, admin_contact) values
  ('c1000000-0000-0000-0000-000000000001','CFA Herblay','Herblay','12 rue de la Formation, 95220 Herblay','01 34 50 00 00','contact@cfa-herblay.fr','Mme Dupont','M. Martin');

-- 3 formateurs
insert into public.trainers(id, first_name, last_name, email, siret, hourly_rate_default, specialties) values
  ('d1000000-0000-0000-0000-000000000001','Siham','B.','siham@example.fr','812345678',42,array['Commerce','Négociation']),
  ('d1000000-0000-0000-0000-000000000002','Sadia','K.','sadia@example.fr','812345679',40,array['Communication','Veille']),
  ('d1000000-0000-0000-0000-000000000003','Reddy','M.','reddy@example.fr','812345680',45,array['Management','Synthèse']);

-- 1 mission : NTC 1 Herblay, hebdomadaire mercredi + jeudi, 15 séances
insert into public.missions(id, cfa_id, formation_id, name, start_date, end_date, default_room, cfa_hourly_rate, trainer_hourly_rate) values
  ('e1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001',
   'NTC Promo 1 — Herblay', current_date, current_date + interval '90 days', 'Salle B12', 60, 42);

-- Génération des 10 premières séances (dates dynamiques)
do $$
declare
  d date := current_date;
  i int := 0;
  cnt int := 0;
begin
  while cnt < 10 loop
    -- séances mardi (2) et jeudi (4)
    if extract(dow from d) in (2,4) then
      insert into public.mission_sessions(mission_id, session_date, start_time, end_time, break_minutes, room, trainer_id)
      values (
        'e1000000-0000-0000-0000-000000000001', d, '09:00', '17:00', 60, 'Salle B12',
        case when cnt % 2 = 0 then 'd1000000-0000-0000-0000-000000000001'::uuid
             else 'd1000000-0000-0000-0000-000000000002'::uuid end
      );
      cnt := cnt + 1;
    end if;
    d := d + 1;
    i := i + 1;
    exit when i > 100;
  end loop;
end $$;

-- Note : après la migration, l'administrateur devra :
-- 1. Créer un compte utilisateur via l'écran d'inscription
-- 2. Mettre à jour le rôle : update public.profiles set role = 'admin' where email = 'votre@email.com';
-- 3. Lier les formateurs à des comptes auth via l'interface admin (V2) ou en SQL :
--    update public.trainers set user_id = 'uuid_du_user' where email = 'siham@example.fr';
