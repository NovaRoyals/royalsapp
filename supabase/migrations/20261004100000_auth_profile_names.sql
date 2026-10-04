-- New accounts: read names the way each sign-in method supplies them.
--
-- Email sign-up sends first_name, last_name and display_name. Google sends full_name, name,
-- given_name and family_name. Either way the profile gets a sensible name, and the email's
-- local part is only a last resort.
--
-- Sign-up data is chosen by whoever signs up, so it is used for names and nothing else: the only
-- role a new account ever gets is 'supporter'. Admins and coaches are assigned by an admin.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full text := nullif(btrim(coalesce(meta ->> 'full_name', meta ->> 'name', '')), '');
  v_first text := nullif(btrim(coalesce(meta ->> 'first_name', meta ->> 'given_name', '')), '');
  v_last text := nullif(btrim(coalesce(meta ->> 'last_name', meta ->> 'family_name', '')), '');
  v_display text := nullif(btrim(coalesce(meta ->> 'display_name', '')), '');
begin
  -- Only a full name: the first word is the first name, the rest is the last.
  if v_first is null and v_full is not null then
    v_first := split_part(v_full, ' ', 1);
    v_last := coalesce(v_last, nullif(btrim(substr(v_full, char_length(v_first) + 1)), ''));
  end if;

  insert into public.profiles (id, display_name, first_name, last_name)
  values (
    new.id,
    left(coalesce(v_display, v_full, nullif(btrim(concat_ws(' ', v_first, v_last)), ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Member'), 80),
    left(v_first, 80),
    left(v_last, 80)
  );
  insert into public.user_roles (user_id, role)
  values (new.id, 'supporter'::public.app_role);
  insert into public.notification_preferences (profile_id) values (new.id);
  return new;
end;
$$;
