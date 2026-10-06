-- ─────────────────────────────────────────────────────────────────────────
-- Documents formateur : CV, diplôme, Kbis / attestation INSEE / INPI, autre
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.trainer_documents (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  doc_type text not null check (doc_type in ('cv','diplome','kbis','insee','inpi','rib','assurance','autre')),
  label text,
  storage_path text not null,       -- chemin dans le bucket Storage
  mime_type text,
  size_bytes bigint,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references auth.users(id)
);

create index if not exists idx_trainer_documents_trainer on public.trainer_documents(trainer_id);

alter table public.trainer_documents enable row level security;

-- Un formateur voit ses propres documents
drop policy if exists p_td_select_own on public.trainer_documents;
create policy p_td_select_own on public.trainer_documents for select
  using (
    exists (select 1 from public.trainers t where t.id = trainer_id and t.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
  );

-- Un formateur insère ses propres documents, admin peut tout
drop policy if exists p_td_insert on public.trainer_documents;
create policy p_td_insert on public.trainer_documents for insert
  with check (
    exists (select 1 from public.trainers t where t.id = trainer_id and t.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
  );

-- Un formateur supprime ses propres documents, admin peut tout
drop policy if exists p_td_delete on public.trainer_documents;
create policy p_td_delete on public.trainer_documents for delete
  using (
    exists (select 1 from public.trainers t where t.id = trainer_id and t.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Bucket Storage privé pour les documents
-- ─────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trainer-docs', 'trainer-docs', false, 10485760,
  array['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Policies Storage : chaque formateur ne peut lire/écrire que les fichiers
-- de son dossier (préfixé par son trainer_id)
drop policy if exists p_storage_td_select on storage.objects;
create policy p_storage_td_select on storage.objects for select
  using (
    bucket_id = 'trainer-docs' and (
      exists (
        select 1 from public.trainers t
        where t.user_id = auth.uid()
          and (storage.foldername(name))[1] = t.id::text
      )
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
    )
  );

drop policy if exists p_storage_td_insert on storage.objects;
create policy p_storage_td_insert on storage.objects for insert
  with check (
    bucket_id = 'trainer-docs' and (
      exists (
        select 1 from public.trainers t
        where t.user_id = auth.uid()
          and (storage.foldername(name))[1] = t.id::text
      )
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
    )
  );

drop policy if exists p_storage_td_delete on storage.objects;
create policy p_storage_td_delete on storage.objects for delete
  using (
    bucket_id = 'trainer-docs' and (
      exists (
        select 1 from public.trainers t
        where t.user_id = auth.uid()
          and (storage.foldername(name))[1] = t.id::text
      )
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
    )
  );
