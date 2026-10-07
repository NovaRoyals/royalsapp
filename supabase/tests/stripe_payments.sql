-- Stripe payment checks. Run after `supabase db reset`:
--   npm run db:test:stripe
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

-- A Stripe "checkout completed" event for a registration, as the webhook would pass it on.
create or replace function pg_temp.event(p_id text, p_type text, p_reg uuid, p_cents integer, p_intent text, p_paid text default 'paid', p_currency text default 'usd')
returns jsonb language sql as $$
  select jsonb_build_object('id', p_id, 'type', p_type, 'data', jsonb_build_object('object', jsonb_build_object(
    'id', 'cs_test_' || p_id, 'client_reference_id', p_reg, 'amount_total', p_cents, 'currency', p_currency,
    'payment_status', p_paid, 'payment_intent', p_intent)));
$$;

-- ---------------------------------------------------------------------------------------
-- Fixtures: two families, an admin, and registrations in different states
-- ---------------------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-5000-0000-0000-000000000001', 'parent-a@example.test'),
  ('aaaaaaaa-5000-0000-0000-000000000002', 'parent-b@example.test'),
  ('aaaaaaaa-5000-0000-0000-000000000003', 'admin@example.test');
insert into public.user_roles (user_id, role) values ('aaaaaaaa-5000-0000-0000-000000000003', 'club_admin');

insert into public.households (id, name, created_by) values
  ('eeeeeeee-5000-0000-0000-000000000001', 'A', 'aaaaaaaa-5000-0000-0000-000000000001'),
  ('eeeeeeee-5000-0000-0000-000000000002', 'B', 'aaaaaaaa-5000-0000-0000-000000000002');
insert into public.household_guardians (household_id, guardian_id) values
  ('eeeeeeee-5000-0000-0000-000000000001', 'aaaaaaaa-5000-0000-0000-000000000001'),
  ('eeeeeeee-5000-0000-0000-000000000002', 'aaaaaaaa-5000-0000-0000-000000000002');

-- ids end in 1..9: 1 owes 12000 and awaits payment; 2 not yet approved; 3 already paid; 4 owes nothing;
-- 5 for a wrong-amount event; 6 for an unpaid-yet event; 7 for expiry; 8 for refunds; 9 belongs to family B
insert into public.registrations (id, program_id, household_id, submitted_by, status, amount_due_cents, payment_status) values
  ('cccccccc-5000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'eeeeeeee-5000-0000-0000-000000000001', 'aaaaaaaa-5000-0000-0000-000000000001', 'approved',  12000, 'awaiting_payment'),
  ('cccccccc-5000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'eeeeeeee-5000-0000-0000-000000000001', 'aaaaaaaa-5000-0000-0000-000000000001', 'submitted', 12000, 'not_requested'),
  ('cccccccc-5000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'eeeeeeee-5000-0000-0000-000000000001', 'aaaaaaaa-5000-0000-0000-000000000001', 'approved',  12000, 'paid'),
  ('cccccccc-5000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'eeeeeeee-5000-0000-0000-000000000001', 'aaaaaaaa-5000-0000-0000-000000000001', 'approved',  0,     'not_requested'),
  ('cccccccc-5000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'eeeeeeee-5000-0000-0000-000000000001', 'aaaaaaaa-5000-0000-0000-000000000001', 'approved',  6000,  'processing'),
  ('cccccccc-5000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 'eeeeeeee-5000-0000-0000-000000000001', 'aaaaaaaa-5000-0000-0000-000000000001', 'approved',  6000,  'processing'),
  ('cccccccc-5000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 'eeeeeeee-5000-0000-0000-000000000001', 'aaaaaaaa-5000-0000-0000-000000000001', 'approved',  6000,  'processing'),
  ('cccccccc-5000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000001', 'eeeeeeee-5000-0000-0000-000000000001', 'aaaaaaaa-5000-0000-0000-000000000001', 'approved',  6000,  'processing'),
  ('cccccccc-5000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000001', 'eeeeeeee-5000-0000-0000-000000000002', 'aaaaaaaa-5000-0000-0000-000000000002', 'approved',  6000,  'awaiting_payment');

-- ---------------------------------------------------------------------------------------
-- Starting to pay: who may, and what they owe
-- ---------------------------------------------------------------------------------------
select pg_temp.act_as('aaaaaaaa-5000-0000-0000-000000000001');
do $$
declare ctx jsonb;
begin
  ctx := public.checkout_context('cccccccc-5000-0000-0000-000000000001');
  if (ctx ->> 'amount_cents')::int <> 12000 or ctx ->> 'currency' <> 'usd' then
    raise exception 'FAIL: wrong amount or currency %', ctx;
  end if;
  if ctx ->> 'email' <> 'parent-a@example.test' then raise exception 'FAIL: the family''s email was not passed on'; end if;
  if (select payment_status::text from public.registrations where id = 'cccccccc-5000-0000-0000-000000000001') <> 'processing' then
    raise exception 'FAIL: starting checkout did not move the registration to processing';
  end if;
  -- Trying again (a closed tab) is fine and gives the same answer.
  if (public.checkout_context('cccccccc-5000-0000-0000-000000000001') ->> 'amount_cents')::int <> 12000 then
    raise exception 'FAIL: a second attempt changed the amount';
  end if;

  begin perform public.checkout_context('cccccccc-5000-0000-0000-000000000002'); raise exception 'FAIL: paid for an unapproved registration';
  exception when sqlstate 'PY001' then null; end;
  begin perform public.checkout_context('cccccccc-5000-0000-0000-000000000003'); raise exception 'FAIL: offered to pay for something already paid';
  exception when sqlstate 'PY002' then null; end;
  begin perform public.checkout_context('cccccccc-5000-0000-0000-000000000004'); raise exception 'FAIL: offered to pay a zero amount';
  exception when sqlstate 'PY002' then null; end;
  begin perform public.checkout_context('cccccccc-5000-0000-0000-000000000009'); raise exception 'FAIL: paid for another family''s registration';
  exception when insufficient_privilege then null; end;
  begin perform public.checkout_context(gen_random_uuid()); raise exception 'FAIL: a missing registration answered differently from someone else''s';
  exception when insufficient_privilege then null; end;
end $$;

-- The admin is not a family: they cannot start a family's checkout either.
reset role;
select pg_temp.act_as('aaaaaaaa-5000-0000-0000-000000000003');
do $$
begin
  begin perform public.checkout_context('cccccccc-5000-0000-0000-000000000009'); raise exception 'FAIL: an admin started a family''s checkout';
  exception when insufficient_privilege then null; end;
end $$;

-- Signed-out visitors and signed-in users cannot record a payment, whoever they are.
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
do $$
begin
  begin perform public.checkout_context('cccccccc-5000-0000-0000-000000000001'); raise exception 'FAIL: signed out started a checkout';
  exception when insufficient_privilege then null; end;
  begin perform public.apply_stripe_event(pg_temp.event('evt_anon', 'checkout.session.completed', 'cccccccc-5000-0000-0000-000000000001', 12000, 'pi_anon'));
    raise exception 'FAIL: a signed-out visitor recorded a payment';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select pg_temp.act_as('aaaaaaaa-5000-0000-0000-000000000003');
do $$
begin
  begin perform public.apply_stripe_event(pg_temp.event('evt_admin', 'checkout.session.completed', 'cccccccc-5000-0000-0000-000000000001', 12000, 'pi_admin'));
    raise exception 'FAIL: an admin in the app recorded a payment';
  exception when insufficient_privilege then null; end;
end $$;

-- ---------------------------------------------------------------------------------------
-- Stripe events, as the webhook (service role) passes them on
-- ---------------------------------------------------------------------------------------
reset role;
set local role service_role;
do $$
declare res jsonb;
begin
  -- The right amount, paid: it counts, once.
  res := public.apply_stripe_event(pg_temp.event('evt_1', 'checkout.session.completed', 'cccccccc-5000-0000-0000-000000000001', 12000, 'pi_1'));
  if res ->> 'result' <> 'paid' then raise exception 'FAIL: a correct payment was not recorded: %', res; end if;
  if (select payment_status::text from public.registrations where id = 'cccccccc-5000-0000-0000-000000000001') <> 'paid' then
    raise exception 'FAIL: registration not marked paid';
  end if;
  if (select count(*) from public.payment_records where registration_id = 'cccccccc-5000-0000-0000-000000000001' and amount_cents = 12000 and status::text = 'paid') <> 1 then
    raise exception 'FAIL: expected one payment record';
  end if;

  -- The same event again does nothing.
  res := public.apply_stripe_event(pg_temp.event('evt_1', 'checkout.session.completed', 'cccccccc-5000-0000-0000-000000000001', 12000, 'pi_1'));
  if res ->> 'result' <> 'duplicate' then raise exception 'FAIL: a replayed event was processed again: %', res; end if;
  if (select count(*) from public.payment_records where registration_id = 'cccccccc-5000-0000-0000-000000000001') <> 1 then
    raise exception 'FAIL: a replay created a second payment record';
  end if;

  -- A second, different payment on the same registration is recorded and flagged, never hidden.
  res := public.apply_stripe_event(pg_temp.event('evt_1b', 'checkout.session.completed', 'cccccccc-5000-0000-0000-000000000001', 12000, 'pi_1b'));
  if res ->> 'result' <> 'duplicate_payment' then raise exception 'FAIL: a double payment was not flagged: %', res; end if;
  if not exists (select 1 from public.registration_events where registration_id = 'cccccccc-5000-0000-0000-000000000001' and action = 'duplicate_payment') then
    raise exception 'FAIL: no refund-needed flag was written';
  end if;

  -- A wrong amount never marks anything paid.
  res := public.apply_stripe_event(pg_temp.event('evt_5', 'checkout.session.completed', 'cccccccc-5000-0000-0000-000000000005', 100, 'pi_5'));
  if res ->> 'result' <> 'amount_mismatch' then raise exception 'FAIL: a wrong amount was accepted: %', res; end if;
  if (select payment_status::text from public.registrations where id = 'cccccccc-5000-0000-0000-000000000005') <> 'processing' then
    raise exception 'FAIL: a wrong amount changed the registration';
  end if;
  if exists (select 1 from public.payment_records where registration_id = 'cccccccc-5000-0000-0000-000000000005') then
    raise exception 'FAIL: a wrong amount created a payment record';
  end if;
  res := public.apply_stripe_event(pg_temp.event('evt_5b', 'checkout.session.completed', 'cccccccc-5000-0000-0000-000000000005', 6000, 'pi_5b', 'paid', 'eur'));
  if res ->> 'result' <> 'amount_mismatch' then raise exception 'FAIL: the wrong currency was accepted: %', res; end if;

  -- Not paid yet (a bank debit that is still pending): nothing happens.
  res := public.apply_stripe_event(pg_temp.event('evt_6', 'checkout.session.completed', 'cccccccc-5000-0000-0000-000000000006', 6000, 'pi_6', 'unpaid'));
  if res ->> 'result' <> 'ignored' or (select payment_status::text from public.registrations where id = 'cccccccc-5000-0000-0000-000000000006') <> 'processing' then
    raise exception 'FAIL: an unpaid session was treated as paid: %', res;
  end if;

  -- An unknown registration is recorded and refused.
  res := public.apply_stripe_event(pg_temp.event('evt_ghost', 'checkout.session.completed', gen_random_uuid(), 6000, 'pi_ghost'));
  if res ->> 'result' <> 'no_registration' then raise exception 'FAIL: a payment for nothing was accepted: %', res; end if;
  res := public.apply_stripe_event(jsonb_build_object('id', 'evt_junk', 'type', 'checkout.session.completed', 'data', jsonb_build_object('object', jsonb_build_object('payment_status', 'paid', 'client_reference_id', 'not-a-uuid', 'amount_total', 1))));
  if res ->> 'result' <> 'no_registration' then raise exception 'FAIL: a malformed reference was accepted: %', res; end if;

  -- The session expired: back to failed, so the family can try again.
  res := public.apply_stripe_event(pg_temp.event('evt_7', 'checkout.session.expired', 'cccccccc-5000-0000-0000-000000000007', 6000, 'pi_7', 'unpaid'));
  if res ->> 'result' <> 'failed' or (select payment_status::text from public.registrations where id = 'cccccccc-5000-0000-0000-000000000007') <> 'failed' then
    raise exception 'FAIL: an expired session did not become failed: %', res;
  end if;
  -- An expired session cannot undo a payment that already happened.
  res := public.apply_stripe_event(pg_temp.event('evt_1x', 'checkout.session.expired', 'cccccccc-5000-0000-0000-000000000001', 12000, 'pi_1x', 'unpaid'));
  if (select payment_status::text from public.registrations where id = 'cccccccc-5000-0000-0000-000000000001') <> 'paid' then
    raise exception 'FAIL: an expired event undid a payment';
  end if;

  -- Refunds: partial, then full.
  perform public.apply_stripe_event(pg_temp.event('evt_8', 'checkout.session.completed', 'cccccccc-5000-0000-0000-000000000008', 6000, 'pi_8'));
  res := public.apply_stripe_event(jsonb_build_object('id', 'evt_8r1', 'type', 'charge.refunded', 'data', jsonb_build_object('object', jsonb_build_object('payment_intent', 'pi_8', 'amount', 6000, 'amount_refunded', 1000))));
  if res ->> 'result' <> 'partially_refunded' or (select payment_status::text from public.registrations where id = 'cccccccc-5000-0000-0000-000000000008') <> 'partially_refunded' then
    raise exception 'FAIL: a partial refund was not recorded: %', res;
  end if;
  res := public.apply_stripe_event(jsonb_build_object('id', 'evt_8r2', 'type', 'charge.refunded', 'data', jsonb_build_object('object', jsonb_build_object('payment_intent', 'pi_8', 'amount', 6000, 'amount_refunded', 6000))));
  if res ->> 'result' <> 'refunded' or (select payment_status::text from public.registrations where id = 'cccccccc-5000-0000-0000-000000000008') <> 'refunded' then
    raise exception 'FAIL: a full refund was not recorded: %', res;
  end if;

  -- Every event is on file, and the ones that were processed say so.
  if (select count(*) from public.payment_events where processed_at is null) <> 0 then
    raise exception 'FAIL: some events were left unprocessed';
  end if;
  if (select count(*) from public.payment_events where event_id = 'evt_1') <> 1 then
    raise exception 'FAIL: the replayed event was stored twice';
  end if;
end $$;

-- Families cannot read the event log or other families' registrations.
reset role;
select pg_temp.act_as('aaaaaaaa-5000-0000-0000-000000000002');
do $$
begin
  begin perform 1 from public.payment_events limit 1; raise exception 'FAIL: a family can read the Stripe event log';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.registrations where household_id = 'eeeeeeee-5000-0000-0000-000000000001') then
    raise exception 'FAIL: a family can see another family''s registrations';
  end if;
end $$;

reset role;
do $$ begin raise notice 'ALL PASSED'; end $$;
rollback;
