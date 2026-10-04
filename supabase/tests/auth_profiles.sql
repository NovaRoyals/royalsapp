-- New-account checks. Run after `supabase db reset`:
--   npm run db:test:auth
-- One transaction, rolled back. A failed check raises an exception that names it; a clean run
-- ends with "ALL PASSED".

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-4000-0000-0000-000000000001', 'jordan@example.test', '{"first_name":"Jordan","last_name":"Cole","display_name":"Jordan Cole"}'),
  ('aaaaaaaa-4000-0000-0000-000000000002', 'sam@example.test', '{"full_name":"Sam Lee Jr","name":"Sam Lee Jr","given_name":"Sam","family_name":"Lee Jr","avatar_url":"https://x.test/a.png"}'),
  ('aaaaaaaa-4000-0000-0000-000000000003', 'priya@example.test', '{"full_name":"Priya Rao"}'),
  ('aaaaaaaa-4000-0000-0000-000000000004', 'plain.person@example.test', '{}'),
  ('aaaaaaaa-4000-0000-0000-000000000005', 'sneaky@example.test', '{"first_name":"Sneaky","role":"club_admin","user_role":"admin","app_role":"club_admin","roles":["club_admin","coach"],"is_admin":true,"relationship":"admin"}'),
  ('aaaaaaaa-4000-0000-0000-000000000006', 'long@example.test', json_build_object('first_name', repeat('x', 300), 'last_name', repeat('y', 300))::jsonb),
  ('aaaaaaaa-4000-0000-0000-000000000007', 'spaces@example.test', '{"first_name":"   ","last_name":"  ","display_name":"  "}');
insert into auth.users (id, raw_user_meta_data) values ('aaaaaaaa-4000-0000-0000-000000000008', '{}');

do $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = 'aaaaaaaa-4000-0000-0000-000000000001';
  if (p.first_name, p.last_name, p.display_name) is distinct from ('Jordan', 'Cole', 'Jordan Cole') then
    raise exception 'FAIL: email sign-up names wrong: %', p;
  end if;

  select * into p from public.profiles where id = 'aaaaaaaa-4000-0000-0000-000000000002';
  if (p.first_name, p.last_name, p.display_name) is distinct from ('Sam', 'Lee Jr', 'Sam Lee Jr') then
    raise exception 'FAIL: Google-style names wrong: %', p;
  end if;

  select * into p from public.profiles where id = 'aaaaaaaa-4000-0000-0000-000000000003';
  if (p.first_name, p.last_name, p.display_name) is distinct from ('Priya', 'Rao', 'Priya Rao') then
    raise exception 'FAIL: a lone full_name was not split: %', p;
  end if;

  select * into p from public.profiles where id = 'aaaaaaaa-4000-0000-0000-000000000004';
  if p.display_name <> 'plain.person' or p.first_name is not null or p.last_name is not null then
    raise exception 'FAIL: no-metadata fallback wrong: %', p;
  end if;

  select * into p from public.profiles where id = 'aaaaaaaa-4000-0000-0000-000000000006';
  if char_length(p.first_name) <> 80 or char_length(p.last_name) <> 80 or char_length(p.display_name) > 80 then
    raise exception 'FAIL: long names were not cut to 80: %', length(p.first_name);
  end if;

  select * into p from public.profiles where id = 'aaaaaaaa-4000-0000-0000-000000000007';
  if p.first_name is not null or p.last_name is not null or p.display_name <> 'spaces' then
    raise exception 'FAIL: blank names were kept: %', p;
  end if;

  select * into p from public.profiles where id = 'aaaaaaaa-4000-0000-0000-000000000008';
  if p.display_name <> 'Member' then raise exception 'FAIL: a sign-up with no email and no name did not get a placeholder: %', p; end if;
end $$;

-- Nothing in the sign-up data can grant a role.
do $$
begin
  if exists (
    select 1 from public.user_roles
    where user_id::text like 'aaaaaaaa-4000-%' and role <> 'supporter'
  ) then
    raise exception 'FAIL: a new account got a role other than supporter';
  end if;
  if (select count(*) from public.user_roles where user_id = 'aaaaaaaa-4000-0000-0000-000000000005') <> 1 then
    raise exception 'FAIL: the hostile sign-up did not end up with exactly one role';
  end if;
  if exists (select 1 from public.team_staff where profile_id::text like 'aaaaaaaa-4000-%') then
    raise exception 'FAIL: a new account became team staff';
  end if;
  if (select count(*) from public.notification_preferences where profile_id::text like 'aaaaaaaa-4000-%') <> 8 then
    raise exception 'FAIL: notification preferences were not created for every new account';
  end if;
end $$;

do $$ begin raise notice 'ALL PASSED'; end $$;
rollback;
