-- Messaging security checks. Run after `supabase db reset`:
--   npm run db:test:messaging
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
-- Fixtures
-- ---------------------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-1000-0000-0000-000000000001', 'parent-a@example.test'),
  ('aaaaaaaa-1000-0000-0000-000000000002', 'parent-b@example.test'),
  ('aaaaaaaa-1000-0000-0000-000000000003', 'parent-d@example.test'),
  ('aaaaaaaa-1000-0000-0000-000000000004', 'coach@example.test'),
  ('aaaaaaaa-1000-0000-0000-000000000005', 'admin@example.test');
insert into public.user_roles (user_id, role) values ('aaaaaaaa-1000-0000-0000-000000000005', 'club_admin');

insert into public.teams (id, sport_id, name, short_name, audience_label) values
  ('dddddddd-0000-0000-0000-000000000001', (select id from public.sports where code = 'soccer'), 'Test U8', 'U8', 'Kids'),
  ('dddddddd-0000-0000-0000-000000000002', (select id from public.sports where code = 'soccer'), 'Test U10', 'U10', 'Kids');
insert into public.team_staff (team_id, profile_id, staff_role, can_publish)
  values ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-1000-0000-0000-000000000004', 'coach', true);

insert into public.households (id, name, created_by) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'A', 'aaaaaaaa-1000-0000-0000-000000000001'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'B', 'aaaaaaaa-1000-0000-0000-000000000002'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'D', 'aaaaaaaa-1000-0000-0000-000000000003');
insert into public.household_guardians (household_id, guardian_id) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-1000-0000-0000-000000000001'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-1000-0000-0000-000000000002'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-1000-0000-0000-000000000003');
insert into public.participants (id, household_id, first_name, last_name, date_of_birth, is_minor, created_by) values
  ('ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', 'Ada', 'A', date '2018-01-01', true, 'aaaaaaaa-1000-0000-0000-000000000001'),
  ('ffffffff-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000002', 'Ben', 'B', date '2018-01-01', true, 'aaaaaaaa-1000-0000-0000-000000000002'),
  ('ffffffff-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000003', 'Dee', 'D', date '2018-01-01', true, 'aaaaaaaa-1000-0000-0000-000000000003');
insert into public.team_memberships (team_id, participant_id, status) values
  ('dddddddd-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001', 'active'),
  ('dddddddd-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000002', 'active'),
  ('dddddddd-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000003', 'active');

-- ---------------------------------------------------------------------------------------
-- The contact-details rule on its own
-- ---------------------------------------------------------------------------------------
do $$
begin
  if not private.contains_contact_info('call me on 571 555 0148') then raise exception 'FAIL: phone number not caught'; end if;
  if not private.contains_contact_info('(571) 555-0148') then raise exception 'FAIL: formatted phone number not caught'; end if;
  if not private.contains_contact_info('mail jordan@example.com') then raise exception 'FAIL: email not caught'; end if;
  if not private.contains_contact_info('see https://example.com/x') then raise exception 'FAIL: link not caught'; end if;
  if private.contains_contact_info('Carpool Sunday? Field 3A, ages 7-8, 9:00 AM') then raise exception 'FAIL: ordinary talk blocked'; end if;
  if private.contains_contact_info('Match is on 2026-10-04') then raise exception 'FAIL: a date was treated as a phone number'; end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- Coach threads
-- ---------------------------------------------------------------------------------------
select pg_temp.act_as('aaaaaaaa-1000-0000-0000-000000000001');
do $$
declare conv uuid; again uuid;
begin
  conv := public.open_coach_conversation('dddddddd-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001');
  again := public.open_coach_conversation('dddddddd-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001');
  if conv <> again then raise exception 'FAIL: a second tap opened a second coach thread'; end if;
  perform set_config('test.coach_conv', conv::text, true);

  begin
    perform public.open_coach_conversation('dddddddd-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000002');
    raise exception 'FAIL: opened a thread for another family';
  exception when insufficient_privilege then null;
  end;

  perform public.send_message(conv, 'Maya will be 15 minutes late. My number is 571 555 0148 if easier.');
  begin
    insert into public.messages (conversation_id, sender_id, body) values (conv, 'aaaaaaaa-1000-0000-0000-000000000001', 'direct insert');
    raise exception 'FAIL: inserted a message directly';
  exception when insufficient_privilege then null;
  end;
end $$;

-- the other family and a family on another team see nothing
reset role;
select pg_temp.act_as('aaaaaaaa-1000-0000-0000-000000000002');
do $$
begin
  if (select count(*) from public.messages) <> 0 then raise exception 'FAIL: another family can read a coach thread'; end if;
  if (select count(*) from public.conversations) <> 0 then raise exception 'FAIL: another family can see a coach conversation'; end if;
  begin
    perform public.send_message(current_setting('test.coach_conv')::uuid, 'sneaking in');
    raise exception 'FAIL: a non-member sent into a thread';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select pg_temp.act_as('aaaaaaaa-1000-0000-0000-000000000003');
do $$
begin
  begin
    perform public.open_coach_conversation('dddddddd-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000003');
    raise exception 'FAIL: a family with no child on the team reached its coach';
  exception when insufficient_privilege then null;
  end;
end $$;

-- the coach sees the family's message and answers
reset role;
select pg_temp.act_as('aaaaaaaa-1000-0000-0000-000000000004');
do $$
declare conv uuid := current_setting('test.coach_conv')::uuid;
begin
  if (select count(*) from public.messages where conversation_id = conv) <> 1 then raise exception 'FAIL: the coach cannot read the family thread'; end if;
  perform public.send_message(conv, 'No problem, see you at 9:15.');
  perform public.mark_conversation_read(conv);
  if (select last_read_at from public.conversation_members where conversation_id = conv and profile_id = 'aaaaaaaa-1000-0000-0000-000000000004') is null
    then raise exception 'FAIL: reading did not record'; end if;
end $$;

-- ---------------------------------------------------------------------------------------
-- Parent chat: opt-in on both sides, same team, no contact details, block, report
-- ---------------------------------------------------------------------------------------
reset role;
select pg_temp.act_as('aaaaaaaa-1000-0000-0000-000000000001');
do $$
begin
  begin
    perform public.open_parent_conversation('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-1000-0000-0000-000000000002');
    raise exception 'FAIL: parent chat opened before anyone opted in';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.list_chat_parents('dddddddd-0000-0000-0000-000000000001');
    raise exception 'FAIL: listed parents without opting in';
  exception when insufficient_privilege then null;
  end;
  perform public.set_parent_chat(true);
end $$;

reset role;
select pg_temp.act_as('aaaaaaaa-1000-0000-0000-000000000002');
do $$
begin
  -- A has opted in, B has not yet
  begin
    perform public.open_parent_conversation('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-1000-0000-0000-000000000001');
    raise exception 'FAIL: opened parent chat when the asker had not opted in';
  exception when insufficient_privilege then null;
  end;
  perform public.set_parent_chat(true);
end $$;

reset role;
select pg_temp.act_as('aaaaaaaa-1000-0000-0000-000000000003');
do $$
begin
  perform public.set_parent_chat(true);
  -- D opted in but has no child on this team
  begin
    perform public.open_parent_conversation('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-1000-0000-0000-000000000001');
    raise exception 'FAIL: parent chat across teams';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select pg_temp.act_as('aaaaaaaa-1000-0000-0000-000000000001');
do $$
declare conv uuid; listed integer;
begin
  select count(*) into listed from public.list_chat_parents('dddddddd-0000-0000-0000-000000000001');
  if listed <> 1 then raise exception 'FAIL: expected exactly one opted-in parent on the team, got %', listed; end if;
  conv := public.open_parent_conversation('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-1000-0000-0000-000000000002');
  perform set_config('test.parent_conv', conv::text, true);
  perform public.send_message(conv, 'Want to sit together on the sideline Sunday?');
  begin
    perform public.send_message(conv, 'Text me on 571 555 0148');
    raise exception 'FAIL: a phone number went through a parent chat';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    perform public.send_message(conv, 'email me at a@example.com');
    raise exception 'FAIL: an email went through a parent chat';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- the coach is not in a parent chat
reset role;
select pg_temp.act_as('aaaaaaaa-1000-0000-0000-000000000004');
do $$
begin
  if exists (select 1 from public.messages where conversation_id = current_setting('test.parent_conv')::uuid) then
    raise exception 'FAIL: the coach can read a parent-to-parent chat';
  end if;
end $$;

-- admins cannot read private conversations until one is reported
reset role;
select pg_temp.act_as('aaaaaaaa-1000-0000-0000-000000000005');
do $$
begin
  if (select count(*) from public.messages) <> 0 then raise exception 'FAIL: an admin can read private messages with no report'; end if;
end $$;

-- B reports the parent chat; reporting also blocks
reset role;
select pg_temp.act_as('aaaaaaaa-1000-0000-0000-000000000002');
do $$
begin
  perform public.report_conversation(current_setting('test.parent_conv')::uuid, 'Made me uncomfortable');
  begin
    perform public.send_message(current_setting('test.parent_conv')::uuid, 'hello?');
    raise exception 'FAIL: sent after blocking by reporting';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select pg_temp.act_as('aaaaaaaa-1000-0000-0000-000000000001');
do $$
begin
  begin
    perform public.send_message(current_setting('test.parent_conv')::uuid, 'are you there?');
    raise exception 'FAIL: a blocked parent could still send';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.list_chat_parents('dddddddd-0000-0000-0000-000000000001')) <> 0 then
    raise exception 'FAIL: a blocked parent still appears in the list';
  end if;
end $$;

-- now the admin can read the reported conversation, and only that one
reset role;
select pg_temp.act_as('aaaaaaaa-1000-0000-0000-000000000005');
do $$
declare reported integer; coach integer;
begin
  select count(*) into reported from public.messages where conversation_id = current_setting('test.parent_conv')::uuid;
  select count(*) into coach from public.messages where conversation_id = current_setting('test.coach_conv')::uuid;
  if reported = 0 then raise exception 'FAIL: the admin cannot read a reported conversation'; end if;
  if coach <> 0 then raise exception 'FAIL: reporting one conversation exposed another'; end if;
  if (select count(*) from public.message_reports) <> 1 then raise exception 'FAIL: the admin cannot see the report'; end if;
end $$;

reset role;
do $$ begin raise notice 'ALL PASSED'; end $$;

rollback;
