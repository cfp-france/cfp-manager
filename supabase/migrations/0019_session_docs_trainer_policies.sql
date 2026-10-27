-- Permettre aux formateurs de voir et uploader des documents sur LEURS PROPRES séances
-- quelle que soit le statut de la saisie (draft, submitted, validated, refused).
-- La policy p_session_docs_read_for_trainers (pour voir les docs des COLLÈGUES) ne s'applique
-- qu'aux saisies validées.

drop policy if exists p_session_docs_read_own_trainer on public.session_documents;
create policy p_session_docs_read_own_trainer on public.session_documents
  for select
  using (
    exists (
      select 1 from public.mission_sessions ms
      join public.trainers t on t.id = ms.trainer_id
      where ms.id = session_documents.session_id and t.user_id = auth.uid()
    )
  );

drop policy if exists p_session_docs_insert_own_trainer on public.session_documents;
create policy p_session_docs_insert_own_trainer on public.session_documents
  for insert
  with check (
    exists (
      select 1 from public.mission_sessions ms
      join public.trainers t on t.id = ms.trainer_id
      where ms.id = session_documents.session_id and t.user_id = auth.uid()
    )
  );

drop policy if exists p_session_docs_delete_own_trainer on public.session_documents;
create policy p_session_docs_delete_own_trainer on public.session_documents
  for delete
  using (
    exists (
      select 1 from public.mission_sessions ms
      join public.trainers t on t.id = ms.trainer_id
      where ms.id = session_documents.session_id and t.user_id = auth.uid()
    )
  );
