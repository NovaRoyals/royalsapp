-- Stripe payments: what the two server functions need from the database.
--
--   * checkout_context(registration)  a signed-in guardian asks to pay for an approved registration.
--                                      The database decides if that is allowed and what is owed.
--                                      The amount is never sent by the app.
--   * apply_stripe_event(event)       called only by the webhook function (service role) after it has
--                                      verified Stripe's signature. The only place `paid` comes from.
--
-- Money rules kept here, not in the functions:
--   * a payment only counts if Stripe says it is paid AND the amount equals what is owed;
--   * the same Stripe event twice does nothing the second time;
--   * a second payment for an already-paid registration is recorded and flagged, not hidden;
--   * a refund moves the registration to refunded or partially_refunded.

-- ---------------------------------------------------------------------------------------
-- A family starts to pay
-- ---------------------------------------------------------------------------------------
create or replace function public.checkout_context(p_registration uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  r public.registrations%rowtype;
  v_title text;
  v_email text;
begin
  if v_user is null then raise exception 'sign in first' using errcode = '28000'; end if;

  select * into r from public.registrations where id = p_registration for update;
  -- One answer for "does not exist" and "is not yours", so ids cannot be probed.
  if not found or r.household_id is null or not exists (
    select 1 from public.household_guardians g where g.household_id = r.household_id and g.guardian_id = v_user
  ) then
    raise exception 'registration not found' using errcode = '42501';
  end if;

  if r.status::text <> 'approved' then
    raise exception 'the club has not approved this registration yet' using errcode = 'PY001';
  end if;
  if r.amount_due_cents <= 0 or r.payment_status::text not in ('awaiting_payment', 'failed', 'processing') then
    raise exception 'there is nothing to pay on this registration' using errcode = 'PY002';
  end if;

  if r.payment_status::text <> 'processing' then
    update public.registrations set payment_status = 'processing', updated_at = now() where id = r.id;
    insert into public.registration_events (registration_id, actor_id, action, from_payment, to_payment)
      values (r.id, v_user, 'checkout_started', r.payment_status::text, 'processing');
  end if;

  select p.title into v_title from public.programs p where p.id = r.program_id;
  select u.email into v_email from auth.users u where u.id = v_user;

  return jsonb_build_object(
    'registration_id', r.id,
    'amount_cents', r.amount_due_cents,
    'currency', 'usd',
    'title', coalesce(v_title, 'NOVA Royals registration'),
    'participants', r.participant_count,
    'email', v_email
  );
end;
$$;

revoke all on function public.checkout_context(uuid) from public, anon;
grant execute on function public.checkout_context(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------
-- A verified Stripe event arrives
-- ---------------------------------------------------------------------------------------
create or replace function public.apply_stripe_event(p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := p_event ->> 'id';
  v_type text := p_event ->> 'type';
  v_obj jsonb := p_event -> 'data' -> 'object';
  v_done timestamptz;
  v_reg uuid;
  r public.registrations%rowtype;
  v_amount integer;
  v_intent text;
  v_rec public.payment_records%rowtype;
  v_refunded integer;
  v_status text;
  v_result text := 'ignored';
begin
  if v_id is null or v_type is null or v_obj is null then
    raise exception 'not a Stripe event';
  end if;

  insert into public.payment_events (provider, event_id, event_type, payload)
    values ('stripe', v_id, v_type, p_event)
    on conflict (provider, event_id) do nothing;
  select processed_at into v_done from public.payment_events where provider = 'stripe' and event_id = v_id;
  if v_done is not null then
    return jsonb_build_object('result', 'duplicate');
  end if;

  if v_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded') then
    if v_obj ->> 'payment_status' = 'paid' then
      begin
        v_reg := (v_obj ->> 'client_reference_id')::uuid;
      exception when others then
        v_reg := null;
      end;
      select * into r from public.registrations where id = v_reg for update;
      v_amount := (v_obj ->> 'amount_total')::integer;
      v_intent := coalesce(v_obj ->> 'payment_intent', v_obj ->> 'id');

      if not found then
        update public.payment_events set error = 'no matching registration', processed_at = now() where provider = 'stripe' and event_id = v_id;
        return jsonb_build_object('result', 'no_registration');
      end if;

      if lower(coalesce(v_obj ->> 'currency', '')) <> 'usd' or v_amount is distinct from r.amount_due_cents then
        -- Money arrived that does not match what is owed. Do not mark anything paid; leave it for a human.
        update public.payment_events
          set error = format('amount mismatch: paid %s %s, owed %s usd cents', v_amount, v_obj ->> 'currency', r.amount_due_cents),
              processed_at = now()
          where provider = 'stripe' and event_id = v_id;
        insert into public.registration_events (registration_id, action, reason)
          values (r.id, 'payment_mismatch', format('Stripe reported %s cents; %s owed', v_amount, r.amount_due_cents));
        return jsonb_build_object('result', 'amount_mismatch');
      end if;

      insert into public.payment_records (registration_id, provider, provider_reference, amount_cents, currency, status, processed_at, provider_event_id)
        values (r.id, 'stripe', v_intent, v_amount, 'USD', 'paid', now(), v_id)
        on conflict (provider, provider_reference) where provider_reference is not null do nothing;

      if r.payment_status::text = 'paid' then
        insert into public.registration_events (registration_id, action, reason)
          values (r.id, 'duplicate_payment', 'A second payment arrived for a registration that was already paid. Refund needed.');
        v_result := 'duplicate_payment';
      else
        update public.registrations set payment_status = 'paid', updated_at = now() where id = r.id;
        insert into public.registration_events (registration_id, action, from_payment, to_payment)
          values (r.id, 'payment_received', r.payment_status::text, 'paid');
        v_result := 'paid';
      end if;
    end if;

  elsif v_type in ('checkout.session.async_payment_failed', 'checkout.session.expired') then
    begin
      v_reg := (v_obj ->> 'client_reference_id')::uuid;
    exception when others then
      v_reg := null;
    end;
    select * into r from public.registrations where id = v_reg for update;
    if found and r.payment_status::text = 'processing' then
      update public.registrations set payment_status = 'failed', updated_at = now() where id = r.id;
      insert into public.registration_events (registration_id, action, from_payment, to_payment, reason)
        values (r.id, 'payment_failed', 'processing', 'failed', v_type);
      v_result := 'failed';
    end if;

  elsif v_type = 'charge.refunded' then
    v_intent := v_obj ->> 'payment_intent';
    select * into v_rec from public.payment_records where provider = 'stripe' and provider_reference = v_intent;
    if found then
      v_refunded := coalesce((v_obj ->> 'amount_refunded')::integer, 0);
      v_status := case when v_refunded >= v_rec.amount_cents then 'refunded' else 'partially_refunded' end;
      update public.payment_records set status = v_status::public.payment_status where id = v_rec.id;
      select * into r from public.registrations where id = v_rec.registration_id for update;
      update public.registrations set payment_status = v_status::public.payment_status, updated_at = now() where id = r.id;
      insert into public.registration_events (registration_id, action, from_payment, to_payment, reason)
        values (r.id, 'refund_recorded', r.payment_status::text, v_status, format('%s of %s cents refunded', v_refunded, v_rec.amount_cents));
      v_result := v_status;
    end if;
  end if;

  update public.payment_events set processed_at = now() where provider = 'stripe' and event_id = v_id;
  return jsonb_build_object('result', v_result);
end;
$$;

-- Only the server (service role) may record a payment. Not families, not admins in the app.
revoke all on function public.apply_stripe_event(jsonb) from public, anon, authenticated;
grant execute on function public.apply_stripe_event(jsonb) to service_role;
