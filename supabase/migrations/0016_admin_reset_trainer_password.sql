-- RPC pour permettre à un admin de définir un nouveau mot de passe sur un compte utilisateur.
-- Note : il est TECHNIQUEMENT IMPOSSIBLE de récupérer le mot de passe actuel d'un utilisateur
-- (stocké en hash bcrypt à sens unique). On ne peut qu'en définir un nouveau.

create or replace function public.admin_reset_trainer_password(
  p_user_id uuid,
  p_new_password text
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Vérifier que l'appelant est admin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Seul un administrateur peut réinitialiser un mot de passe.';
  end if;

  -- Vérifier que le user_id cible correspond bien à un formateur
  if not exists (
    select 1 from public.trainers t where t.user_id = p_user_id
  ) then
    raise exception 'L''utilisateur cible n''est pas un formateur enregistré.';
  end if;

  -- Longueur minimale
  if length(p_new_password) < 8 then
    raise exception 'Mot de passe trop court (minimum 8 caractères).';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now(),
      recovery_token = '',
      recovery_sent_at = null,
      banned_until = null
  where id = p_user_id;
end;
$$;

grant execute on function public.admin_reset_trainer_password(uuid, text) to authenticated;
