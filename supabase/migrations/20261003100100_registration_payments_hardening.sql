-- Registration and payment hardening.
--
-- Before this migration a signed-in family could write its own registration row directly:
-- the insert policy only checked who submitted it, and the draft-update policy locked no
-- columns. That meant a client could set status = 'approved', payment_status = 'paid' and
-- amount_due_cents = 0 on its own registration, or choose its own per-child price and the
-- waiver text it "signed". Owners could also read internal_notes, because row-level security
-- filters rows, not columns.
--
-- After it:
--   * families cannot insert or update registrations, participants, consents or payments;
--   * the only way in is public.submit_registration, which recomputes the price, checks
--     authority, age and capacity, snapshots the waiver text from the database, and is
--     idempotent;
--   * club decisions go through admin_decide_registration / admin_waive_fee, which require a
--     reason where one matters and write a registration_events audit row;
--   * internal notes live in an admin-only table;
--   * Stripe-side tables exist (payment_events, refunds, donations) for the webhook and
--     refund functions to use, with no access for the app at all.
--
-- NOT YET RUN against a database in this repository's history. Run supabase db reset and
-- supabase/tests/registration_security.sql before relying on it.

-- ---------------------------------------------------------------------------------------
-- 0. Move saved rows onto the new vocabulary
-- ---------------------------------------------------------------------------------------
update public.registrations set payment_status = 'not_requested' where payment_status in ('unpaid', 'pending');
update public.registrations set status = 'submitted' where status = 'pending';
update public.registration_participants set status = 'submitted' where status = 'pending';
alter table public.registrations alter column payment_status set default 'not_requested';

-- ---------------------------------------------------------------------------------------
-- 1. Internal notes leave the registrations row
-- ---------------------------------------------------------------------------------------
create table public.registration_internal_notes (
  registration_id uuid primary key references public.registrations(id) on delete cascade,
  notes text not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.registration_internal_notes (registration_id, notes, updated_by)
select id, internal_notes, reviewed_by
from public.registrations
where internal_notes is not null and btrim(internal_notes) <> '';

alter table public.registrations drop column internal_notes;

alter table public.registration_internal_notes enable row level security;
create policy registration_notes_admin on public.registration_internal_notes for all to authenticated
  using (private.is_club_admin()) with check (private.is_club_admin());
revoke all on public.registration_internal_notes from anon;
grant select, insert, update, delete on public.registration_internal_notes to authenticated;

-- ---------------------------------------------------------------------------------------
-- 2. Idempotency key (a repeated tap or retry returns the first registration)
-- ---------------------------------------------------------------------------------------
alter table public.registrations add column idempotency_key text;
create unique index registrations_idempotency_idx
  on public.registrations (submitted_by, idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------------------------
-- 3. Families read, but never write
-- ---------------------------------------------------------------------------------------
drop policy if exists registrations_owner_create on public.registrations;
drop policy if exists registrations_draft_update on public.registrations;
drop policy if exists registrations_admin_update on public.registrations;
drop policy if exists registration_participants_owner_create on public.registration_participants;
drop policy if exists consents_signer_create on public.consent_acceptances;

revoke insert, update, delete on public.registrations from authenticated;
revoke insert, update, delete on public.registration_participants from authenticated;
revoke insert, update, delete on public.consent_acceptances from authenticated;
revoke insert, update, delete on public.payment_records from authenticated;

-- Column-level read: reviewer identity and the idempotency key are not for families.
revoke select on public.registrations from authenticated;
grant select (
  id, program_id, household_id, submitted_by, status, participant_count,
  subtotal_cents, discount_cents, amount_due_cents, payment_status,
  submitted_at, reviewed_at, created_at, updated_at
) on public.registrations to authenticated;

-- ---------------------------------------------------------------------------------------
-- 4. Pricing rules: the mid-season offer lives in data, not in the app
-- ---------------------------------------------------------------------------------------
alter table public.program_pricing drop constraint if exists program_pricing_pricing_type_check;
alter table public.program_pricing
  add constraint program_pricing_pricing_type_check
  check (pricing_type in ('standard', 'sibling', 'early_bird', 'team', 'other', 'per_session', 'floor'));

-- Session start times for a weekly program, built from starts_at / ends_at in club time so
-- daylight saving does not shift a 9:00 AM session.
create or replace function private.program_session_starts(p_program uuid)
returns setof timestamptz
language sql
stable
set search_path = ''
as $$
  select ((p.starts_at at time zone 'America/New_York') + (n * interval '7 days')) at time zone 'America/New_York'
  from public.programs p
  cross join generate_series(0, 60) as n
  where p.id = p_program
    and p.starts_at is not null
    and p.ends_at is not null
    and ((p.starts_at at time zone 'America/New_York') + (n * interval '7 days'))
        <= (p.ends_at at time zone 'America/New_York') + interval '1 day'
  order by n;
$$;

-- The price for this many children right now. Mirrors src/lib/pricing.ts: full price until
-- the first session starts, then per_session x sessions left, never below the floor, and
-- siblings get the same share. The app shows a quote; this function decides the charge.
create or replace function private.quote_registration(p_program uuid, p_count integer, p_now timestamptz default now())
returns table (
  first_child_cents integer,
  sibling_cents integer,
  total_cents integer,
  full_rate_cents integer,
  percent_off integer,
  sessions_left integer,
  sessions_total integer
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_full integer;
  v_sibling integer;
  v_per integer;
  v_floor integer;
  v_first timestamptz;
  v_total integer;
  v_left integer;
  v_prorated integer;
  v_share numeric := 1;
  v_first_cents integer;
  v_sibling_cents integer;
begin
  if p_count is null or p_count < 1 then
    raise exception 'at least one participant is required';
  end if;

  select amount_cents into v_full from public.program_pricing
    where program_id = p_program and active and pricing_type = 'standard'
    order by coalesce(applies_from_participant_number, 1) limit 1;
  if v_full is null then
    raise exception 'this program has no active standard price';
  end if;
  select amount_cents into v_sibling from public.program_pricing
    where program_id = p_program and active and pricing_type = 'sibling' limit 1;
  select amount_cents into v_per from public.program_pricing
    where program_id = p_program and active and pricing_type = 'per_session' limit 1;
  select amount_cents into v_floor from public.program_pricing
    where program_id = p_program and active and pricing_type = 'floor' limit 1;
  v_sibling := coalesce(v_sibling, v_full);

  select count(*), min(s.starts_at), count(*) filter (where s.starts_at > p_now)
    into v_total, v_first, v_left
  from private.program_session_starts(p_program) as s(starts_at);

  v_first_cents := v_full;
  v_sibling_cents := v_sibling;
  if v_per is not null and v_first is not null and p_now >= v_first then
    v_prorated := least(v_full, greatest(coalesce(v_floor, 0), v_left * v_per));
    v_share := v_prorated::numeric / v_full;
    v_first_cents := v_prorated;
    v_sibling_cents := (round(v_sibling * v_share / 100.0) * 100)::integer;
  end if;

  first_child_cents := v_first_cents;
  sibling_cents := v_sibling_cents;
  total_cents := v_first_cents + (p_count - 1) * v_sibling_cents;
  full_rate_cents := p_count * v_full;
  percent_off := round((1 - v_share) * 100)::integer;
  sessions_left := v_left;
  sessions_total := v_total;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- 5. Audit trail for registration decisions
-- ---------------------------------------------------------------------------------------
create table public.registration_events (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  from_status text,
  to_status text,
  from_payment text,
  to_payment text,
  reason text,
  created_at timestamptz not null default now()
);
create index registration_events_registration_idx on public.registration_events (registration_id, created_at desc);

alter table public.registration_events enable row level security;
create policy registration_events_admin_read on public.registration_events for select to authenticated
  using (private.is_club_admin());
revoke all on public.registration_events from anon;
revoke all on public.registration_events from authenticated;
grant select on public.registration_events to authenticated;

-- ---------------------------------------------------------------------------------------
-- 6. submit_registration: the only way a family creates a registration
-- ---------------------------------------------------------------------------------------
create or replace function public.submit_registration(
  p_program uuid,
  p_household uuid,
  p_participants uuid[],
  p_signature text,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing uuid;
  v_program public.programs%rowtype;
  v_quote record;
  v_status public.registration_status := 'submitted';
  v_taken integer;
  v_reg uuid;
  v_pid uuid;
  v_position integer := 0;
  v_price integer;
  v_waivers integer;
begin
  if v_user is null then
    raise exception 'sign in to register' using errcode = '28000';
  end if;
  if p_participants is null or cardinality(p_participants) < 1 then
    raise exception 'choose at least one participant';
  end if;
  if (select count(distinct x) from unnest(p_participants) as x) <> cardinality(p_participants) then
    raise exception 'a participant was listed twice';
  end if;
  if length(btrim(coalesce(p_signature, ''))) < 2 then
    raise exception 'a typed signature is required';
  end if;

  if p_idempotency_key is not null then
    select id into v_existing from public.registrations
      where submitted_by = v_user and idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

  -- Serialize per program so two families cannot take the last spot at once.
  perform pg_advisory_xact_lock(hashtext('registration:' || p_program::text));

  select * into v_program from public.programs
    where id = p_program and is_published and registration_open;
  if not found then
    raise exception 'registration is not open for this program';
  end if;
  if v_program.registration_opens_at is not null and now() < v_program.registration_opens_at then
    raise exception 'registration has not opened yet';
  end if;
  if v_program.registration_closes_at is not null and now() > v_program.registration_closes_at then
    raise exception 'registration has closed';
  end if;

  if p_household is not null and not private.can_manage_household(p_household) then
    raise exception 'you cannot register for this household' using errcode = '42501';
  end if;

  if exists (
    select 1
    from unnest(p_participants) as x
    left join public.participants pt on pt.id = x
    where pt.id is null
       or not (pt.profile_id = v_user
               or (pt.household_id is not null and private.can_manage_household(pt.household_id)))
  ) then
    raise exception 'you cannot register one or more of these participants' using errcode = '42501';
  end if;

  if v_program.min_age is not null or v_program.max_age is not null then
    if exists (
      select 1
      from unnest(p_participants) as x
      join public.participants pt on pt.id = x
      where date_part('year', age(coalesce(v_program.starts_at, now())::date, pt.date_of_birth)) < coalesce(v_program.min_age, 0)
         or date_part('year', age(coalesce(v_program.starts_at, now())::date, pt.date_of_birth)) > coalesce(v_program.max_age, 200)
    ) then
      raise exception 'a participant is outside the age range for this program';
    end if;
  end if;

  if exists (
    select 1
    from public.registration_participants rp
    join public.registrations r on r.id = rp.registration_id
    where r.program_id = p_program
      and rp.participant_id = any (p_participants)
      and r.status not in ('rejected', 'cancelled')
      and rp.status not in ('rejected', 'cancelled')
  ) then
    raise exception 'a participant is already registered for this program';
  end if;

  select count(*) into v_waivers from public.waivers w
    where (w.program_id = p_program or w.program_id is null)
      and w.required and w.effective_at <= now() and (w.retired_at is null or w.retired_at > now());
  if v_waivers = 0 then
    raise exception 'no waiver is published for this program';
  end if;

  select * into v_quote from private.quote_registration(p_program, cardinality(p_participants), now());
  if v_quote.sessions_total > 0 and v_quote.sessions_left = 0 then
    raise exception 'this season is over';
  end if;

  -- A full program takes the registration as a waitlist entry rather than refusing it.
  if v_program.capacity is not null then
    select count(*) into v_taken
    from public.registration_participants rp
    join public.registrations r on r.id = rp.registration_id
    where r.program_id = p_program and r.status in ('submitted', 'approved') and rp.status in ('submitted', 'approved');
    if v_taken + cardinality(p_participants) > v_program.capacity then
      v_status := 'waitlisted';
    end if;
  end if;

  insert into public.registrations (
    program_id, household_id, submitted_by, status, participant_count,
    subtotal_cents, discount_cents, amount_due_cents, payment_status, submitted_at, idempotency_key
  ) values (
    p_program, p_household, v_user, v_status, cardinality(p_participants),
    v_quote.full_rate_cents, v_quote.full_rate_cents - v_quote.total_cents, v_quote.total_cents,
    'not_requested', now(), p_idempotency_key
  ) returning id into v_reg;

  foreach v_pid in array p_participants loop
    v_position := v_position + 1;
    v_price := case when v_position = 1 then v_quote.first_child_cents else v_quote.sibling_cents end;
    insert into public.registration_participants (registration_id, participant_id, price_cents, discount_cents, status)
    values (v_reg, v_pid, v_price, greatest(0, (v_quote.full_rate_cents / cardinality(p_participants)) - v_price), v_status);

    -- The text signed is the text the database holds, never text the client sends.
    insert into public.consent_acceptances (
      registration_id, participant_id, waiver_id, accepted_by, typed_signature, signed_at, waiver_body_snapshot
    )
    select v_reg, v_pid, w.id, v_user, btrim(p_signature), now(), w.body
    from public.waivers w
    where (w.program_id = p_program or w.program_id is null)
      and w.required and w.effective_at <= now() and (w.retired_at is null or w.retired_at > now());
  end loop;

  insert into public.registration_events (registration_id, actor_id, action, to_status, to_payment)
  values (v_reg, v_user, 'submitted', v_status::text, 'not_requested');

  return v_reg;
end;
$$;

revoke all on function public.submit_registration(uuid, uuid, uuid[], text, text) from public, anon;
grant execute on function public.submit_registration(uuid, uuid, uuid[], text, text) to authenticated;

-- ---------------------------------------------------------------------------------------
-- 7. Club decisions and fee waivers
-- ---------------------------------------------------------------------------------------
create or replace function public.admin_decide_registration(
  p_registration uuid,
  p_decision text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := (select auth.uid());
  v public.registrations%rowtype;
  v_new_status text;
  v_new_payment text;
  v_settled boolean;
begin
  if not private.is_club_admin() then
    raise exception 'club administrators only' using errcode = '42501';
  end if;
  if p_decision not in ('approve', 'waitlist', 'reject', 'cancel') then
    raise exception 'unknown decision %', p_decision;
  end if;
  if p_decision in ('reject', 'cancel') and length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'a reason is required';
  end if;

  select * into v from public.registrations where id = p_registration for update;
  if not found then
    raise exception 'registration not found';
  end if;

  v_settled := v.payment_status::text in ('paid', 'partially_refunded', 'refunded', 'waived', 'processing');

  if p_decision = 'approve' then
    v_new_status := 'approved';
    v_new_payment := case
      when v.amount_due_cents = 0 or v_settled then v.payment_status::text
      else 'awaiting_payment'
    end;
  else
    v_new_status := case p_decision when 'waitlist' then 'waitlisted' when 'reject' then 'rejected' else 'cancelled' end;
    v_new_payment := case
      when v_settled then v.payment_status::text
      when p_decision = 'waitlist' then 'not_requested'
      else 'canceled'
    end;
  end if;

  update public.registrations
    set status = v_new_status::public.registration_status,
        payment_status = v_new_payment::public.payment_status,
        reviewed_by = v_admin,
        reviewed_at = now(),
        updated_at = now()
    where id = p_registration;

  update public.registration_participants
    set status = v_new_status::public.registration_status
    where registration_id = p_registration;

  insert into public.registration_events (registration_id, actor_id, action, from_status, to_status, from_payment, to_payment, reason)
  values (p_registration, v_admin, p_decision, v.status::text, v_new_status, v.payment_status::text, v_new_payment, nullif(btrim(coalesce(p_reason, '')), ''));
end;
$$;

revoke all on function public.admin_decide_registration(uuid, text, text) from public, anon;
grant execute on function public.admin_decide_registration(uuid, text, text) to authenticated;

create or replace function public.admin_waive_fee(p_registration uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := (select auth.uid());
  v public.registrations%rowtype;
begin
  if not private.is_club_admin() then
    raise exception 'club administrators only' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'a reason is required';
  end if;

  select * into v from public.registrations where id = p_registration for update;
  if not found then
    raise exception 'registration not found';
  end if;
  if v.amount_due_cents = 0 or v.payment_status::text not in ('not_requested', 'awaiting_payment', 'failed') then
    raise exception 'there is nothing to waive on this registration';
  end if;

  update public.registrations
    set payment_status = 'waived', reviewed_by = v_admin, reviewed_at = now(), updated_at = now()
    where id = p_registration;

  insert into public.registration_events (registration_id, actor_id, action, from_payment, to_payment, reason)
  values (p_registration, v_admin, 'waive_fee', v.payment_status::text, 'waived', btrim(p_reason));
end;
$$;

revoke all on function public.admin_waive_fee(uuid, text) from public, anon;
grant execute on function public.admin_waive_fee(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------------------
-- 8. Stripe-side tables. Only server functions using the service role touch these.
-- ---------------------------------------------------------------------------------------
alter table public.payment_records
  add column if not exists payment_kind text not null default 'registration' check (payment_kind in ('registration')),
  add column if not exists provider_event_id text;

-- One provider reference is one payment. A replayed webhook cannot create a second row.
create unique index if not exists payment_records_provider_ref_idx
  on public.payment_records (provider, provider_reference)
  where provider_reference is not null;

-- Every webhook delivery is recorded once. The unique key makes processing idempotent.
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (provider, event_id)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_record_id uuid not null references public.payment_records(id),
  amount_cents integer not null check (amount_cents > 0),
  reason text not null,
  requested_by uuid references public.profiles(id),
  provider_reference text,
  status text not null default 'requested' check (status in ('requested', 'succeeded', 'failed', 'canceled')),
  created_at timestamptz not null default now()
);
create unique index refunds_provider_ref_idx on public.refunds (provider_reference) where provider_reference is not null;

-- Charitable gifts are never mixed into a registration amount.
create table public.donations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD',
  provider text not null,
  provider_reference text,
  status public.payment_status not null default 'awaiting_payment',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  constraint donation_no_demo_reference check (not is_demo or provider_reference is null)
);
create unique index donations_provider_ref_idx on public.donations (provider, provider_reference) where provider_reference is not null;

alter table public.payment_events enable row level security;
alter table public.refunds enable row level security;
alter table public.donations enable row level security;

create policy refunds_admin_read on public.refunds for select to authenticated using (private.is_club_admin());
create policy donations_owner_read on public.donations for select to authenticated
  using (profile_id = (select auth.uid()) or private.is_club_admin());

-- Grants are explicit so behavior does not depend on the project's default-privilege setting.
-- Supabase can hand every new public table to anon and authenticated by default; take it back,
-- then give back only the read each policy above describes.
revoke all on public.payment_events from anon, authenticated;
revoke all on public.refunds from anon, authenticated;
grant select on public.refunds to authenticated;
revoke all on public.donations from anon, authenticated;
grant select on public.donations to authenticated;
