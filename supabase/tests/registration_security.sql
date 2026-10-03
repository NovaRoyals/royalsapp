-- Registration and payment security checks.
--
-- Run against a local database after `supabase db reset`:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/registration_security.sql
--
-- Everything runs inside one transaction that is rolled back, so it leaves no data behind.
-- A failed check raises an exception that names it. A clean run ends with "ALL PASSED".
--
-- Status: written alongside migration 20261003100100 but NOT YET EXECUTED. Docker was not
-- running when it was written. Treat a first run as part of verifying the migration.

begin;

-- ----------------------------------------------------------------------------------------
-- Fixtures (as the database owner)
-- ----------------------------------------------------------------------------------------
create or replace function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
end;
$$;

create or replace function pg_temp.act_as_owner() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'family-a@example.test'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'family-b@example.test'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'admin@example.test');
insert into public.user_roles (user_id, role) values ('aaaaaaaa-0000-0000-0000-000000000003', 'club_admin');

insert into public.households (id, name, created_by) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Family A', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Family B', 'aaaaaaaa-0000-0000-0000-000000000002');
insert into public.household_guardians (household_id, guardian_id) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');
insert into public.participants (id, household_id, first_name, last_name, date_of_birth, is_minor, created_by) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Ada', 'A', date '2018-05-05', true, 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Ben', 'A', date '2020-03-03', true, 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 'Cy', 'B', date '2017-01-01', true, 'aaaaaaaa-0000-0000-0000-000000000002');

-- Put the seeded program safely before its first session so submit prices are deterministic
-- whatever day this test runs. The date-pinned quote checks below pass explicit times.
update public.programs
  set starts_at = date_trunc('hour', now()) + interval '3 days',
      ends_at = date_trunc('hour', now()) + interval '3 days' + interval '70 days' + interval '1 hour',
      registration_open = true, is_published = true, capacity = 3
  where id = '20000000-0000-0000-0000-000000000001';

-- ----------------------------------------------------------------------------------------
-- 1. The price rule (owner-only function, explicit clock)
-- ----------------------------------------------------------------------------------------
-- Pin the real season so these checks do not drift with the calendar.
update public.programs
  set starts_at = '2026-09-13 09:00:00-04', ends_at = '2026-11-22 10:00:00-05'
  where id = '20000000-0000-0000-0000-000000000001';

do $$
declare q record;
begin
  select * into q from private.quote_registration('20000000-0000-0000-0000-000000000001', 1, '2026-09-01 12:00:00-04');
  if q.first_child_cents <> 12000 or q.percent_off <> 0 then raise exception 'FAIL pre-season price: %', q; end if;

  select * into q from private.quote_registration('20000000-0000-0000-0000-000000000001', 2, '2026-10-03 12:00:00-04');
  if q.sessions_total <> 11 then raise exception 'FAIL season length: %', q; end if;
  if q.sessions_left <> 8 or q.first_child_cents <> 8000 or q.sibling_cents <> 4000 or q.total_cents <> 12000 or q.percent_off <> 33
    then raise exception 'FAIL mid-season price: %', q; end if;

  select * into q from private.quote_registration('20000000-0000-0000-0000-000000000001', 1, '2026-11-08 07:00:00-05');
  if q.first_child_cents <> 6000 or q.percent_off <> 50 then raise exception 'FAIL price floor: %', q; end if;

  -- 9:00 AM EST on Nov 1 is 14:00Z: a minute either side flips the count (daylight saving check)
  if (select sessions_left from private.quote_registration('20000000-0000-0000-0000-000000000001', 1, '2026-11-01 13:59:00+00')) <> 4
    or (select sessions_left from private.quote_registration('20000000-0000-0000-0000-000000000001', 1, '2026-11-01 14:01:00+00')) <> 3
    then raise exception 'FAIL daylight-saving boundary'; end if;
end $$;

-- Restore the future dates for the submit checks.
update public.programs p
  set starts_at = date_trunc('hour', now()) + interval '3 days',
      ends_at = date_trunc('hour', now()) + interval '3 days' + interval '70 days' + interval '1 hour'
  where p.id = '20000000-0000-0000-0000-000000000001';

-- ----------------------------------------------------------------------------------------
-- 2. Families cannot write money columns or other families' data
-- ----------------------------------------------------------------------------------------
reset role;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');

do $$
begin
  begin
    insert into public.registrations (program_id, submitted_by, status, amount_due_cents, payment_status)
    values ('20000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'approved', 0, 'paid');
    raise exception 'FAIL: a family inserted its own approved, paid registration';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.payment_records (registration_id, provider, amount_cents, status)
    values (gen_random_uuid(), 'stripe', 100, 'paid');
    raise exception 'FAIL: a family inserted a payment record';
  exception when insufficient_privilege then null;
  end;

  begin
    perform 1 from public.payment_events limit 1;
    raise exception 'FAIL: a family can read webhook events';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ----------------------------------------------------------------------------------------
-- 3. submit_registration: the one way in
-- ----------------------------------------------------------------------------------------
do $$
declare
  reg uuid;
  again uuid;
  total integer;
  discount integer;
  stmt text;
begin
  reg := public.submit_registration(
    '20000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
    array['cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002']::uuid[],
    'Parent A', 'tap-1');
  if reg is null then raise exception 'FAIL: submit returned nothing'; end if;

  select amount_due_cents, discount_cents into total, discount from public.registrations where id = reg;
  if total <> 18000 or discount <> 6000 then raise exception 'FAIL: server price % / discount % (want 18000 / 6000)', total, discount; end if;

  again := public.submit_registration(
    '20000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
    array['cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002']::uuid[],
    'Parent A', 'tap-1');
  if again <> reg then raise exception 'FAIL: a repeated tap created a second registration'; end if;

  if (select status::text from public.registrations where id = reg) <> 'submitted'
    or (select payment_status::text from public.registrations where id = reg) <> 'not_requested'
    then raise exception 'FAIL: a new registration must be submitted and not_requested'; end if;

  -- own row is readable, reviewer identity is not
  begin
    execute format('select reviewed_by from public.registrations where id = %L', reg);
    raise exception 'FAIL: a family can read reviewed_by';
  exception when insufficient_privilege then null;
  end;

  -- direct tampering is refused
  begin
    update public.registrations set amount_due_cents = 1, payment_status = 'paid' where id = reg;
    raise exception 'FAIL: a family updated its own registration';
  exception when insufficient_privilege then null;
  end;

  -- someone else's child and a repeat registration are both refused
  begin
    perform public.submit_registration('20000000-0000-0000-0000-000000000001', null,
      array['cccccccc-0000-0000-0000-000000000003']::uuid[], 'Parent A');
    raise exception 'FAIL: registered another family''s child';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.submit_registration('20000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
      array['cccccccc-0000-0000-0000-000000000001']::uuid[], 'Parent A', 'tap-2');
    raise exception 'FAIL: registered the same child twice';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  perform set_config('test.reg', reg::text, true);
end $$;

-- the signed text came from the database
reset role;
select pg_temp.act_as_owner();
do $$
declare reg uuid := current_setting('test.reg')::uuid;
begin
  if (select count(*) from public.consent_acceptances where registration_id = reg) <> 4
    then raise exception 'FAIL: expected two waivers for each of two children'; end if;
  if exists (
    select 1 from public.consent_acceptances c join public.waivers w on w.id = c.waiver_id
    where c.registration_id = reg and c.waiver_body_snapshot <> w.body
  ) then raise exception 'FAIL: waiver snapshot does not match the published text'; end if;
end $$;

-- ----------------------------------------------------------------------------------------
-- 4. Other families cannot see it, and cannot decide it
-- ----------------------------------------------------------------------------------------
reset role;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000002');
do $$
declare reg uuid := current_setting('test.reg')::uuid;
begin
  if (select count(*) from public.registrations where id = reg) <> 0
    then raise exception 'FAIL: another family can see this registration'; end if;
  begin
    perform public.admin_decide_registration(reg, 'approve');
    raise exception 'FAIL: a family approved a registration';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ----------------------------------------------------------------------------------------
-- 5. Club decisions
-- ----------------------------------------------------------------------------------------
reset role;
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000003');
do $$
declare reg uuid := current_setting('test.reg')::uuid;
begin
  begin
    perform public.admin_decide_registration(reg, 'reject');
    raise exception 'FAIL: rejected without a reason';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  perform public.admin_decide_registration(reg, 'approve');
  if (select status::text from public.registrations where id = reg) <> 'approved'
    or (select payment_status::text from public.registrations where id = reg) <> 'awaiting_payment'
    then raise exception 'FAIL: approval should request payment'; end if;

  perform public.admin_waive_fee(reg, 'Scholarship');
  if (select payment_status::text from public.registrations where id = reg) <> 'waived'
    then raise exception 'FAIL: fee was not waived'; end if;
  begin
    perform public.admin_waive_fee(reg, 'Again');
    raise exception 'FAIL: waived a fee twice';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  if (select count(*) from public.registration_events where registration_id = reg) <> 3
    then raise exception 'FAIL: expected submitted, approve and waive_fee in the audit trail'; end if;
end $$;

reset role;
select pg_temp.act_as_owner();
do $$ begin raise notice 'ALL PASSED'; end $$;

rollback;
