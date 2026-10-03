-- Coach polish checks. Run after `supabase db reset`:
--   npm run db:test:polish
-- One transaction, rolled back. A failed check raises an exception that names it; a clean run
-- ends with "ALL PASSED".

begin;

create or replace function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Fixtures: a coach of U8, a coach of U10, a parent on U8, an admin
-- ---------------------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-2000-0000-0000-000000000001', 'coach8@example.test'),
  ('aaaaaaaa-2000-0000-0000-000000000002', 'coach10@example.test'),
  ('aaaaaaaa-2000-0000-0000-000000000003', 'parent8@example.test'),
  ('aaaaaaaa-2000-0000-0000-000000000004', 'admin@example.test'),
  ('aaaaaaaa-2000-0000-0000-000000000005', 'parent10@example.test');
insert into public.user_roles (user_id, role) values ('aaaaaaaa-2000-0000-0000-000000000004', 'club_admin');
update public.profiles set first_name = 'Priya', last_name = 'Rao' where id = 'aaaaaaaa-2000-0000-0000-000000000003';
update public.profiles set first_name = 'Hannah', last_name = 'Lopez' where id = 'aaaaaaaa-2000-0000-0000-000000000005';

insert into public.teams (id, sport_id, name, short_name, audience_label) values
  ('dddddddd-2000-0000-0000-000000000001', (select id from public.sports where code = 'soccer'), 'Polish U8', 'U8', 'Kids'),
  ('dddddddd-2000-0000-0000-000000000002', (select id from public.sports where code = 'soccer'), 'Polish U10', 'U10', 'Kids');
insert into public.team_staff (team_id, profile_id, staff_role, can_publish) values
  ('dddddddd-2000-0000-0000-000000000001', 'aaaaaaaa-2000-0000-0000-000000000001', 'coach', true),
  ('dddddddd-2000-0000-0000-000000000002', 'aaaaaaaa-2000-0000-0000-000000000002', 'coach', true);

insert into public.households (id, name, created_by) values
  ('eeeeeeee-2000-0000-0000-000000000001', 'Rao', 'aaaaaaaa-2000-0000-0000-000000000003'),
  ('eeeeeeee-2000-0000-0000-000000000002', 'Lopez', 'aaaaaaaa-2000-0000-0000-000000000005');
insert into public.household_guardians (household_id, guardian_id) values
  ('eeeeeeee-2000-0000-0000-000000000001', 'aaaaaaaa-2000-0000-0000-000000000003'),
  ('eeeeeeee-2000-0000-0000-000000000002', 'aaaaaaaa-2000-0000-0000-000000000005');
insert into public.participants (id, household_id, first_name, last_name, preferred_name, date_of_birth, is_minor, created_by) values
  ('ffffffff-2000-0000-0000-000000000001', 'eeeeeeee-2000-0000-0000-000000000001', 'Maya', 'Rao', 'Mimi', date '2018-01-01', true, 'aaaaaaaa-2000-0000-0000-000000000003'),
  ('ffffffff-2000-0000-0000-000000000002', 'eeeeeeee-2000-0000-0000-000000000002', 'Zoltan', 'Lopez', null, date '2016-01-01', true, 'aaaaaaaa-2000-0000-0000-000000000005');
insert into public.team_memberships (team_id, participant_id, status) values
  ('dddddddd-2000-0000-0000-000000000001', 'ffffffff-2000-0000-0000-000000000001', 'active'),
  ('dddddddd-2000-0000-0000-000000000002', 'ffffffff-2000-0000-0000-000000000002', 'active');

-- ---------------------------------------------------------------------------------------
-- A coach gets the names to hide for their own team, and only that team
-- ---------------------------------------------------------------------------------------
select pg_temp.act_as('aaaaaaaa-2000-0000-0000-000000000001');
do $$
declare ctx jsonb; names jsonb;
begin
  ctx := public.polish_context('dddddddd-2000-0000-0000-000000000001');
  names := ctx -> 'names';
  if not (names ? 'maya' and names ? 'rao' and names ? 'mimi') then
    raise exception 'FAIL: the child''s first, last and preferred names were not returned: %', names;
  end if;
  if not (names ? 'priya') then raise exception 'FAIL: the guardian''s name was not returned: %', names; end if;
  if names ? 'zoltan' or names ? 'hannah' then raise exception 'FAIL: another team''s names leaked: %', names; end if;
  if (ctx ->> 'remaining')::int <> 30 then raise exception 'FAIL: wrong allowance %', ctx; end if;

  begin
    perform public.polish_context('dddddddd-2000-0000-0000-000000000002');
    raise exception 'FAIL: a coach polished for a team they do not coach';
  exception when insufficient_privilege then null;
  end;

  perform public.log_polish('dddddddd-2000-0000-0000-000000000001', null, 'Maya did well.', 'The group did well.', 'warm');
  begin
    perform public.log_polish('dddddddd-2000-0000-0000-000000000002', null, 'x', 'y', 'warm');
    raise exception 'FAIL: logged a polish for another team';
  exception when insufficient_privilege then null;
  end;
  if (public.polish_context('dddddddd-2000-0000-0000-000000000001') ->> 'remaining')::int <> 29 then
    raise exception 'FAIL: a logged polish did not use up one of the allowance';
  end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- Parents and signed-out visitors cannot use it
-- ---------------------------------------------------------------------------------------
select pg_temp.act_as('aaaaaaaa-2000-0000-0000-000000000003');
do $$
begin
  begin
    perform public.polish_context('dddddddd-2000-0000-0000-000000000001');
    raise exception 'FAIL: a parent used polish';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.log_polish('dddddddd-2000-0000-0000-000000000001', null, 'x', 'y', 'cleanup');
    raise exception 'FAIL: a parent wrote a polish log';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.coach_polish_logs) then
    raise exception 'FAIL: a parent can read polish logs';
  end if;
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
do $$
begin
  begin
    perform public.polish_context('dddddddd-2000-0000-0000-000000000001');
    raise exception 'FAIL: a signed-out visitor used polish';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------------------
-- The admin can audit; the coach cannot read the log table directly
-- ---------------------------------------------------------------------------------------
reset role;
select pg_temp.act_as('aaaaaaaa-2000-0000-0000-000000000004');
do $$
begin
  if (select count(*) from public.coach_polish_logs) <> 1 then raise exception 'FAIL: the admin cannot see the audit row'; end if;
  perform public.polish_context('dddddddd-2000-0000-0000-000000000002');
end $$;

reset role;
select pg_temp.act_as('aaaaaaaa-2000-0000-0000-000000000001');
do $$
begin
  if exists (select 1 from public.coach_polish_logs) then raise exception 'FAIL: a coach can read the polish log table'; end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- Rate limit: thirty an hour, then a refusal that names the reason
-- ---------------------------------------------------------------------------------------
reset role;
insert into public.coach_polish_logs (coach_id, original_text, generated_text, mode)
  select 'aaaaaaaa-2000-0000-0000-000000000002', 'a', 'b', 'cleanup' from generate_series(1, 30);
select pg_temp.act_as('aaaaaaaa-2000-0000-0000-000000000002');
do $$
begin
  begin
    perform public.polish_context('dddddddd-2000-0000-0000-000000000002');
    raise exception 'FAIL: the rate limit did not stop the 31st polish';
  exception when sqlstate 'RL001' then null;
  end;
end $$;

-- Old rows stop counting.
reset role;
update public.coach_polish_logs set created_at = now() - interval '2 hours' where coach_id = 'aaaaaaaa-2000-0000-0000-000000000002';
select pg_temp.act_as('aaaaaaaa-2000-0000-0000-000000000002');
do $$
begin
  if (public.polish_context('dddddddd-2000-0000-0000-000000000002') ->> 'remaining')::int <> 30 then
    raise exception 'FAIL: polishes older than an hour still count';
  end if;
end $$;

reset role;
do $$ begin raise notice 'ALL PASSED'; end $$;
rollback;
