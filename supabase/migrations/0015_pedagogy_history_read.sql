-- Permet aux formateurs de consulter en lecture seule les saisies pédagogiques VALIDÉES
-- de leurs collègues (pour la fonctionnalité « Historique classe » utile aux remplacements).
-- La policy existante p_entries_read reste en vigueur pour les saisies draft/submitted/refused.

drop policy if exists p_entries_read_validated_for_trainers on public.time_entries;
create policy p_entries_read_validated_for_trainers on public.time_entries
  for select
  using (
    status = 'validated' and exists (
      select 1 from public.trainers t where t.user_id = auth.uid() and t.active = true
    )
  );

-- Idem pour les supports pédagogiques attachés aux séances validées
drop policy if exists p_session_docs_read_for_trainers on public.session_documents;
create policy p_session_docs_read_for_trainers on public.session_documents
  for select
  using (
    exists (
      select 1 from public.trainers t where t.user_id = auth.uid() and t.active = true
    )
    and exists (
      select 1 from public.time_entries te
      where te.session_id = session_documents.session_id and te.status = 'validated'
    )
  );
