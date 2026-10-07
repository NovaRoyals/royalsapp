# Payments: how registration and money work

Decision: **the club approves first, then asks the family to pay.** Nothing is charged at
submission. This matches the wording families already see ("Pending club review. Payment has
not been taken.") and avoids refunds on rejected registrations.

## Two states that move separately

| Registration status | Meaning |
| --- | --- |
| `submitted` | Family sent it; the club has not decided |
| `approved` | The club said yes |
| `waitlisted` | Full, or held; nothing to pay |
| `rejected` / `cancelled` | Ended |

| Payment status | Meaning |
| --- | --- |
| `not_requested` | Nobody has asked for money yet |
| `awaiting_payment` | Approved; the family owes the amount |
| `processing` | Checkout started; waiting for the server to confirm |
| `paid` | **Only ever set from a verified Stripe webhook event** |
| `failed` / `canceled` | Attempt failed or was withdrawn; can be retried or is moot |
| `waived` | The club cleared the fee (admin action, reason required) |
| `partially_refunded` / `refunded` | Money went back |

Approving moves `not_requested` to `awaiting_payment` when the amount is above zero. Any
other decision withdraws an unpaid request. A payment that was already taken is never erased
by a decision; the app flags "refund needed".

The pure rules live in `src/lib/registrationFlow.ts` (15 tests in `tests/registrationFlow.test.ts`)
and are mirrored in SQL in `admin_decide_registration` / `admin_waive_fee`.

## Price

Full season: **$120 first child, $60 each sibling.** After the first session starts: **$10 per
remaining Sunday, never below $60** for the first child, siblings at the same share, shown to
families as a percentage off ("33% off if you join now · 8 Sundays left"). Maximum 50% off.

The rule is in one place per layer: `src/lib/pricing.ts` (display, tested) and
`private.quote_registration` (the charge, SQL). The client never sends an amount.
`program_pricing` holds the numbers (`standard`, `sibling`, `per_session`, `floor`).

Open question for the club: the docs said 12 sessions; the calendar and database have 11
Sundays (Sep 13 to Nov 22). The offer is $10 per *remaining* Sunday, so it does not depend on
that count, but "$10/session across N Sundays" copy was removed rather than guessed.

## What is built

- Pricing rule, status model, admin decisions, waivers, audit trail, double-submit guard (app, tested).
- Payment seam `src/services/payments.ts`: the app only asks the server to start a checkout for
  a registration id. Today it answers "unavailable" honestly.
- Database hardening migration (`20261003100100`): families cannot write registrations or money
  columns; `submit_registration` recomputes price, checks authority, age and capacity, snapshots
  waiver text from the database and is idempotent; Stripe-side tables exist for the webhook.
  Verified against a local database: `supabase db reset`, then `npm run db:test`
  (`supabase/tests/registration_security.sql`, ends in ALL PASSED). The first run caught a real hole
  (a parent could register another family's child) that is now fixed.

## Status: test-mode payments verified end to end (2026-10-07)

Built: `create-checkout` and `stripe-webhook` Edge Functions, `checkout_context` and
`apply_stripe_event` in the database (migration `20261007100000`), a Stripe gateway behind
the payment seam (web only for now) and a return page that never says "paid" itself. Tests:
`tests/stripe.test.ts` (21), `npm run db:test:stripe` (SQL), each safeguard checked by breaking it.

Verified live on the hosted project in Stripe test mode, with a temporary family that was removed
afterwards: the real `create-checkout` returned a Stripe payment page for the database's amount
($120), a test card paid it, Stripe's signed event arrived at `stripe-webhook`, and the
registration became `paid` about a minute and a half later with one payment record and the audit
trail `checkout_started`, `payment_received`.

Still to do: refunds (admin function), receipts, donations, paying inside the phone app, wiring the
app's registrations to the database so a parent can reach this from the screens, and a decision on
the club's existing website checkout (it runs on Stripe separately). Live payments stay off: the
functions refuse a live key unless `STRIPE_ALLOW_LIVE=yes` is set on purpose.

## What was planned for Stripe (kept for reference)

1. Edge Function `create-payment`: authenticated, loads the registration, requires
   `awaiting_payment` (or `failed`), recomputes the amount from `program_pricing`, creates a hosted
   Checkout Session with an idempotency key and the registration id in metadata, sets `processing`.
2. Edge Function `stripe-webhook`: verify the signature on the raw body, insert into
   `payment_events` (unique `event_id`; a replay does nothing), then set `paid` / `failed` and
   write `payment_records`. This is the only place `paid` comes from.
3. Edge Functions for refunds (admin only, reason required, writes `refunds`).
4. A Stripe gateway behind the existing `PaymentGateway` interface. Hosted Checkout works in Expo
   Go and on the web (`expo-web-browser`, return by the `royals://` link or a web redirect). Native
   PaymentSheet and Apple Pay / Google Pay need an EAS development build and come later.
5. Receipts, and donations as their own flow (`donations` table; never mixed into a registration).

Secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) live only in Supabase function secrets.
