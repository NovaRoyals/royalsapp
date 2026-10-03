# What is built, what is not, and what is left

As of 2026-10-03, branch `stage-3-polish`. Plain language first; the detail is below it.

## The honest one-line status

The app looks and behaves like the finished product, but it still runs on **demo data stored on the device**. It is **not connected to Supabase**, and **nothing charges money**. Everything below is organised around those two facts.

## Is the app connected to Supabase?

**No.** `src/lib/supabase.ts` only creates a client when `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set. Neither is set, so the app reports "Demo mode" and every screen reads and writes local state (`AppProvider`, saved in AsyncStorage). A read-only Supabase repository exists for programs, teams, schedule, competitions and the older announcements table, but no screen writes through it.

What Supabase *is* right now: a database running on this computer, used to prove the migrations work.

## What Docker was for, and whether it is finished

Docker runs the local Supabase stack (Postgres plus the API layer). I used it to:

1. Apply every migration and the seed file to a real Postgres. Done. This found and fixed two bugs that had never been caught: a policy that referred to columns that do not exist, and a trailing comma in the seed.
2. Run security tests against the rules that matter most. Done, both pass:
   - `npm run db:test` covers registration and payment rules (a parent cannot approve their own registration, cannot set a price, cannot mark anything paid).
   - `npm run db:test:messaging` covers who can read and send messages, parent chat opt-in, blocking and reporting.
3. It found a real hole (a NULL comparison that let the wrong person submit a registration). Fixed and covered by the test.

**Not done with Docker:** connecting the app to that database, creating a real hosted Supabase project, and anything involving Stripe. Docker is only a test bench; it never touches real data.

## Built and working in the app (demo mode)

| Area | State |
| --- | --- |
| Pro-rated pricing (percent off, $60 floor) | Done, 11 unit tests |
| Registration: submitted, in review, approved, paid are separate and truthful | Done, 16 tests. Payment itself is a stub that says "not available yet" |
| Messaging: coach chat, optional parent chat, block and report | Done in the app and in the database, 16 tests plus SQL tests |
| Announcements: club, team or program; Latest and Past; cancellations pinned | Done, 24 tests (includes notification priority) |
| Notifications that cannot be muted for cancellations | Done |
| Forecast heads-up on Home and each session | Done, live from Open-Meteo, no key, 11 tests |
| Coach recap: record, edit, polish, personalise, preview, schedule, send | Done, compact; **recording and AI polish are demos** (below) |
| Visual redesign, onboarding, Roy, spacing | Done and checked screen by screen |

## Built only as a stand-in, so it will not work for real until replaced

- **Voice recording.** The button plays a fake "recording" and fills in a sample transcript. No microphone audio is captured. The screen says so.
- **AI polish.** In demo mode, a deterministic text tidier (`src/lib/ai/coachPolish.ts`) that does not call a model. The real path is built: the `coach-polish` Edge Function (DeepSeek V4 Flash through OpenRouter), its database functions, rate limit, audit log and 28 tests, and it runs correctly in the local Edge runtime. What has **not** been tested is a live answer from OpenRouter, because that needs your key. See `docs/AI_POLISH.md`.
- **Push notifications.** The app marks which notifications *would* push and which cannot be muted, but nothing is delivered to a phone. Needs a development build and Apple and Google credentials.
- **Messages are not live.** They are local; there is no realtime delivery between two phones.

## What is missing, in the order I would do it

### Needs you (accounts and keys)

1. **Stripe, test mode only.** Create the account, then give me the test publishable key for the app and put the secret key and webhook secret in Supabase secrets (never in the repo). I can then build and test `create-payment`, the webhook, refunds and receipts. A payment is only called working once server, webhook, saved result and screen have all been tested end to end.
2. **A hosted Supabase project** (free tier is fine to start). Gives the URL and publishable key for the app, and a place to run `supabase db push`.
3. **An AI provider key** (OpenRouter, as the design says) for the real coach polish, stored as an Edge Function secret.
4. **Apple Developer and Google Play accounts** and an EAS login, for Apple Pay, a real build, and push notifications.

### I can build without any account

1. **Connect the app to Supabase.** Sign-in, then move registrations, messages and announcements from local state to the database through the tested functions. This is the largest remaining piece. It can be done against the local Docker database first.
2. **Database side of announcements.** The database has a simple `announcements` table. The richer model in the app (kinds, club or team or program audience, cancellation priority, which sessions a cancellation closes) needs a migration, a security-definer publish function and a SQL test, the same way messaging was done.
3. **Fix WEB-001** (hydration error on refresh of saved routes) before any public web release. See `docs/known-issues.md`.
4. **Regression test for hard refresh** on the main routes (listed in `known-issues.md`).
5. **Fields page.** Better showcase for the 41 fields: group by park, search, filter chips. Not started; a separate set of uncommitted Loudoun reservation work is in the working tree and has not been touched or committed.

## Decisions I need from the club

1. **Season length.** The price is $10 a session and the full season is $120, which is 12 sessions, but the calendar from 13 Sep to 22 Nov has 11 Sundays. Which is right?
2. **Can coaches cancel on their own?** Today yes, for their own team (`COACH_MAY_CANCEL` in `src/lib/announcements.ts`). Set it to `false` and a coach's cancellation goes to the club office first.
3. **Messaging policy.** Five open questions at the bottom of `docs/MESSAGING.md` (who reviews reports, retention, parent chat for the youngest ages, and so on).
4. **"Onboarding portal".** I linked About to the onboarding experience; tell me if you meant something else.
5. **Weather wording.** The forecast only informs; the coach or club still decides. Say so if you want different wording.

## Rules I kept

Stripe test mode only, no live keys, no secrets in code or Git. No deployment, production secret, real charge, destructive migration or irreversible database action without asking first. Guest privacy, honest attendance, coach recap privacy, supporter counts kept apart from roster counts.
