-- Supports pédagogiques attachés à une saisie (déroulé pédagogique)

create table if not exists public.session_documents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mission_sessions(id) on delete cascade,
  trainer_id uuid references public.trainers(id) on delete set null,
  label text,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references auth.users(id)
);

create index if not exists idx_session_documents_session on public.session_documents(session_id);

alter table public.session_documents enable row level security;

-- Formateur : voit/ajoute/supprime les documents de ses propres séances
-- Admin : voit tout
drop policy if exists p_sd_select on public.session_documents;
create policy p_sd_select on public.session_documents for select using (
  exists (
    select 1 from public.mission_sessions ms
    join public.trainers t on t.id = ms.trainer_id
    where ms.id = session_id and t.user_id = auth.uid()
  )
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);
drop policy if exists p_sd_insert on public.session_documents;
create policy p_sd_insert on public.session_documents for insert with check (
  exists (
    select 1 from public.mission_sessions ms
    join public.trainers t on t.id = ms.trainer_id
    where ms.id = session_id and t.user_id = auth.uid()
  )
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);
drop policy if exists p_sd_delete on public.session_documents;
create policy p_sd_delete on public.session_documents for delete using (
  exists (
    select 1 from public.mission_sessions ms
    join public.trainers t on t.id = ms.trainer_id
    where ms.id = session_id and t.user_id = auth.uid()
  )
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
);

-- Bucket Storage privé pour les supports pédagogiques
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('session-docs', 'session-docs', false, 20971520,
  array['application/pdf','image/jpeg','image/png','image/webp','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain','video/mp4'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Policies Storage : préfixe = session_id
drop policy if exists p_storage_sd_select on storage.objects;
create policy p_storage_sd_select on storage.objects for select using (
  bucket_id = 'session-docs' and (
    exists (
      select 1 from public.mission_sessions ms
      join public.trainers t on t.id = ms.trainer_id
      where ms.id::text = (storage.foldername(name))[1] and t.user_id = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
  )
);
drop policy if exists p_storage_sd_insert on storage.objects;
create policy p_storage_sd_insert on storage.objects for insert with check (
  bucket_id = 'session-docs' and (
    exists (
      select 1 from public.mission_sessions ms
      join public.trainers t on t.id = ms.trainer_id
      where ms.id::text = (storage.foldername(name))[1] and t.user_id = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
  )
);
drop policy if exists p_storage_sd_delete on storage.objects;
create policy p_storage_sd_delete on storage.objects for delete using (
  bucket_id = 'session-docs' and (
    exists (
      select 1 from public.mission_sessions ms
      join public.trainers t on t.id = ms.trainer_id
      where ms.id::text = (storage.foldername(name))[1] and t.user_id = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coordinator'))
  )
);
