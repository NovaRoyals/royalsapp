# Stage 2 Cursor prompt — Personalization, Communication & Season Experience

Copy everything below the line into a new Cursor agent chat (Grok 4.6 / Agent mode) while on branch `stage-2`. Do not paste this into Stage 1 `master`.

---

You are implementing **Stage 2** of ROYALS, the digital home of Nova Royals Athletic Club (Northern Virginia 501(c)(3)). The product name is always **ROYALS**.

You are **not** starting a new app. You are upgrading an existing Expo Router + TypeScript prototype that already works.

Repo: `royals/` on Git branch **`stage-2`**. Stage 1 is frozen on `master` at commit `be128a3` (`Stage 1 - working prototype before Stage 2`). If you ever need the Stage 1 snapshot, `git switch master` or `git checkout be128a3`. **Never rewrite `master`.**

## Mission

Stage 1 already has discovery, programs, guardian/adult registration, My/Club schedule, teams, RSVP, and a demo admin. The remaining problem is **not information architecture**. It is a **retention / workflow gap after registration**.

Stage 2 must make ROYALS start behaving like a **real club operating system**: it knows who I am, finishes the parent journey after checkout, makes schedule operational, makes communication useful, and surfaces club-wide community without adding a sixth tab.

**Do not keep adding disconnected features from a list. Build complete user journeys.**

Official name:

## Stage 2 — Personalization, Communication & Season Experience

### Goals

**A. Personalize** — Onboarding → role → household → followed teams/programs → notification preferences → personalized Home briefing.

**B. Complete the parent journey** — Registration → payment/waiver status → confirmation → **Season Hub**.

**C. Make Schedule operational** — Field status, weather, directions, parking notes, RSVP, attendance/check-in, add season to calendar, contact coach, supporter RSVP (“I’m coming to support”).

**D. Communication** — Urgent club alerts, team/program announcements, coach contact, **announcement + parent reply / DM foundation**. Do **not** build Discord / unrestricted group chat.

**E. Household** — Attendance, bills, receipts, documents/waivers, notification preferences (Profile, not a new tab).

**F. Club-wide community** — “This Week at ROYALS”, cross-team games, supporter counts, volunteer spots. Lives on **Home / Profile / club content**, never a new bottom tab.

**G. Context-aware screens** — Kids training ≠ FXA league team ≠ tournament ≠ cricket. Do not show league table UI on a children’s training program.

## What NOT to change (hard constraints)

Keep these exactly unless a Stage 2 journey is impossible without a small extension:

- Five tabs only: **Home, Programs, Schedule, Teams, Profile**.
- Current visual language: near-black/charcoal, warm cream, Royals orange `#F36A21` for CTAs. Compact cards, strong type, restrained radius, 44–52px controls.
- Product name **ROYALS**. Do not rebrand or genericize.
- Guardian vs adult registration branching.
- Soccer + Cricket as sports; add **Fitness as a third program vertical** (Programs filter + community pulse), **not** a new tab.
- Youth roster privacy: no public child DOB; youth PII stays household/authorized-staff only.
- RSVP + calendar abstractions.
- **My Schedule / Club Schedule** split.
- Demo mode when Supabase env vars are missing (`src/lib/supabase.ts`). Do not require credentials.
- Do not invent real payment charges. Demo payments stay pending/simulated.
- Do not present invented scores/standings as real. Men’s 8v8 fixtures/squad from Stage 1 are club-provided; women’s/cricket demo data stays labeled DEMO.
- Do not enable billing, paid APIs, or Expo production store release.
- Do not expose secrets. Do not commit `.env`.
- Do not add Kids/Men/Women/Cricket as permanent tabs.
- Do not rebuild navigation, theme tokens, or the registration wizard from scratch. Extend them.

Sponsors, About, Support Us, Volunteer, Contact can live under **Profile → About ROYALS**. They are not primary architecture.

## Current codebase (extend, don’t replace)

Key files:

- `src/app/(tabs)/` — Home, Programs, Schedule, Teams, Profile
- `src/app/onboarding.tsx` — exists but is thin (role pick only; seeded parent demo)
- `src/app/registration/[programId].tsx` — strong 7-step youth checkout; confirmation is weak
- `src/app/event/[id].tsx`, `src/app/team/[id].tsx`, `src/app/competition/[id].tsx`
- `src/app/notifications.tsx`, `src/app/admin.tsx`
- `src/state/AppProvider.tsx` — persisted demo state (schedule merge from `demoSchedule`)
- `src/data/demo.ts`, `src/data/repository.ts`
- `src/types/domain.ts` — `UserRole` already includes guest / adult_player / guardian / coach / competition_manager / admin. Add `volunteer` if needed.
- `src/theme/tokens.ts`, `src/components/ui.tsx`
- `docs/PRODUCT.md`, `docs/DATA_MODEL.md`, `docs/SECURITY.md`, `docs/ASSUMPTIONS.md`

Public preview exists at EAS Hosting; keep `expo.web.output: "static"` and `generateStaticParams` on dynamic routes so web export still works.

## Product diagnosis to honor

The app currently shows **the club’s information**, not **my family’s slice of the club**. After registration, parents cannot clearly answer:

- Did registration go through?
- What did I pay?
- Is my child assigned yet?
- Who is the coach?
- When is the first practice?
- What should they bring?
- How do I contact someone?

Home must become a **briefing**, not more cards. Example (role-aware; do not hardcode this copy for every role):

> Maya has training Sunday at 10 AM  
> Field status: Open  
> 1 unread coach announcement  
> Registration payment due Sept 20  
> Men’s team plays Wednesday  
> Cricket plays Sunday — “Going to support?”

## Journeys to implement (complete, end to end)

### 1. First-run identity (highest leverage)

Upgrade onboarding. First run should **not** dump users into a seeded parent home forever without choice, but **keep a demo “preview as parent” path** so board members can still evaluate instantly.

Flow:

1. Role: **Parent / Player / Coach / Volunteer** (map Volunteer → guest+volunteer flags or a `volunteer` role; keep admin behind Profile staff entry).
2. Children / ages (parent only; ages private).
3. Followed teams / programs (multi-select; soccer, cricket, fitness, kids, men, women).
4. Notification preferences (urgent / team / community).
5. Land on personalized Home.

Persist in `AppProvider`. Guests still browse. Switching role from Profile remains for demo.

### 2. Personalized Home briefing

Replace the “club brochure + register hero always on top” signed-in home with a **contextual briefing**:

- Next commitment per followed child/team (name, when, field status).
- Unread announcements count.
- Payment / registration status if outstanding.
- Cross-club pulse (“This Week at ROYALS”) with supporter RSVP.
- Volunteer callouts when relevant.
- One primary CTA (register, RSVP, pay, read alert) — not ten equal cards.

Guest home may keep discovery + registration, plus a lighter “This Week at ROYALS”.

### 3. Registration Confirmation / Season Hub (polish this; it can be a highlight)

After checkout, do not dump to a thin success line. Add a durable **Season Hub** (route e.g. `/season/[registrationId]` or `/household/season/[id]`, linked from confirmation, Home, and Profile).

Hub sections, in order:

1. Registration confirmed  
2. Payment status (demo: pending vs paid; no real charge)  
3. Team assignment status (unassigned / assigned)  
4. Coach (name + contact action)  
5. First session (when / where / what to bring)  
6. Add entire season to calendar (existing calendar service)  
7. Waiver / documents  
8. Contact coach  

Wire the existing registration confirmation step into this hub.

### 4. Communication (core product, not a side feature)

Three levels only:

| Level | Example | Who | Channel |
| ----- | ------- | --- | ------- |
| Urgent club alert | Sully Highlands fields closed due to weather | People attending affected events / followed venues | Push-shaped in-app + notification center |
| Team/program announcement | Kids U8 practice moved to Field 3 | Roster / parents of that program | In-app + optional push flag |
| Team conversation foundation | Parent ↔ coach | Membership-gated | Announcement thread + reply / DM — **not** open group chat |

Youth privacy:

- Start with **coach announcements + parent replies/DMs**.
- No child-to-child chat.
- No public youth identities in club-wide feeds.
- Moderated; coach/admin can post; parents reply in context.

Reuse `notifications.tsx` and announcements in `AppProvider`. Add message threads in demo state. Do not add a chat tab.

### 5. Operational Schedule

Keep **My Schedule** vs **Club Schedule**.

**My Schedule:** all my children, my teams, practices, games, tournaments.

**Club Schedule:** Soccer, Cricket, Fitness, community events.

Event cards / event detail gain (use placeholders where live APIs don’t exist; label clearly):

- Field status (Open / Closed / Delayed) — demo + admin/coach can set
- Weather — stub/service abstraction, not a paid API requirement
- Directions (maps link from venue)
- Parking notes
- RSVP (existing)
- Attendance / check-in (coach records; parent sees own child)
- Add season to calendar
- Contact coach
- “I’m coming to support” (supporter RSVP, distinct from player RSVP)

### 6. Household (Profile)

Profile becomes the household OS, still one tab:

- Children & followed teams
- Attendance summary
- Bills / receipts (demo)
- Documents / waivers
- Notification preferences
- About ROYALS (About, Support Us, Sponsors, Volunteer, Contact)

### 7. Admin / coach speed (operational, not a second product)

Stage 2 fails if a board member must type the same Saturday game in five places.

Upgrade `/admin` (and coach-limited tools on team/event screens) so one person can, quickly:

- Enter / edit a game or practice
- Cancel a practice / set field closed (creates urgent alert)
- Record attendance
- Assign a child to a team (unlocks Season Hub assignment)
- Send an announcement (club vs team vs program; urgency)
- Approve registration

Coach: attendance, announcements, limited schedule edits for **their** team. Admin: all of the above.

### 8. Context-aware competition UI

- Kids training program: sessions, what to bring, coach, RSVP — **no standings table**.
- Men’s FXA-style league team: fixtures, RSVP, no invented table unless labeled demo/empty.
- Tournament: entry, dates, groups/brackets as already architected.
- Cricket: CCPL labeled external; don’t fake official league ownership.

Fitness: program cards + schedule/community events, not a fake league.

## Role capability matrix (implement in UI + AppProvider helpers)

Enforce in the client for demo; keep comments that RLS remains the production source of truth.

| Feature | Guest | Parent | Adult Player | Coach | Volunteer | Admin |
| ------- | ----- | ------ | ------------ | ----- | --------- | ----- |
| Browse programs | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Register child | | ✓ | | | | ✓ |
| Register self (adult program) | | | ✓ | | | ✓ |
| RSVP own events | | ✓ | ✓ | ✓ | supporter RSVP | ✓ |
| Record attendance | | | | ✓ own team | | ✓ |
| Send announcement | | | | ✓ own team | | ✓ |
| Urgent field closure | | | | limited | | ✓ |
| Edit schedules | | | | limited own team | | ✓ |
| Assign child to team | | | | | | ✓ |
| View child DOB | | own child | | authorized team only | | ✓ |
| Club admin | | | | | | ✓ |

Hide or disable actions that the current role cannot perform. Do not only hide on honor system in copy.

## Notifications matrix (do not spam)

Specify **what creates one**, **who receives it**, **urgency**. Implement as in-app notifications + optional “push would fire” demo labels. No production push credentials required.

| Urgency | Trigger | Recipients | Surface |
| ------- | ------- | ---------- | ------- |
| URGENT | Field closure / weather cancel | Everyone attending that event / following that venue | Banner + notification center + would-push |
| HIGH | Schedule time/field change | Roster + parents | Notification center + would-push |
| NORMAL | Coach announcement | Team / program | In-app + optional push preference |
| LOW | Club news / community | Followers | Notification center only |

Respect onboarding notification preferences. Urgent cannot be fully opted out (show in-app); marketing/community can.

## Real vs demo vs user-generated data

Keep this distinction visible in UI (`DemoBadge` / factual flags) and in `docs/ASSUMPTIONS.md`.

**REAL (treat as club-true unless noted):** programs that already match novaroyalsac.com, Fall Soccer Training 2026 pricing/dates, men’s 8v8 fixtures/squad, club contact/venue facts already researched.

**DEMO until integration:** scores, standings, some player names (women/cricket), attendance history, some rosters, weather provider, payment capture.

**USER-GENERATED (persist locally in demo):** onboarding choices, followed teams, registrations, RSVP, supporter RSVP, announcement replies, attendance marks, notification reads, field status overrides from admin.

Never promote demo standings into “official” language.

## Analytics (Kids Soccer funnel; local only)

Add a small `src/lib/analytics.ts` (or similar) that records events in memory + AsyncStorage. No third-party SaaS, no PII beyond role-safe event names.

Events:

- `program_viewed`
- `registration_started`
- `registration_completed`
- `child_added`
- `rsvp_completed`
- `notification_opened`
- `attendance_recorded`
- `re_registration` (if they start another child/season)

Admin (or Profile demo) can show a simple funnel: e.g. program views → starts → completions. This is for board/marketing, not a public screen.

## Future integrations (architecture only — do not build them)

Create a short `docs/INTEGRATIONS.md` and thin service interfaces (existing payments/calendar/notifications pattern):

- FXA schedules/results
- Stripe (or chosen processor) + webhooks
- Google/Apple Calendar
- Maps
- Weather / field status
- Email/SMS
- Production push
- Social/share
- Existing registration data import

Stage 2 must **anticipate** these. Stage 2 must **not** become an integrations project. Stubs + comments are enough. No paid accounts.

## Implementation rules

- Stay on `stage-2`. Do not commit unless asked.
- Prefer extending `AppProvider`, `demo.ts`, `domain.ts`, and existing screens.
- Add routes only when a journey needs a durable URL (Season Hub, message thread, season documents).
- Update `docs/PRODUCT.md` and `docs/ASSUMPTIONS.md` to match shipped Stage 2 behavior.
- Keep web static export working (`npx expo export --platform web`). Fix `generateStaticParams` for new dynamic routes.
- Typecheck and lint.
- Verify in the browser: onboarding, Home briefing as parent, registration → Season Hub, schedule event operational actions, announcement + reply, admin assign/cancel/attend, Profile household, guest browse still works. Check that changing role updates Home/Schedule consistently (no stale Fairfax-style cache bugs).
- If a screen is shared, **derive** content from role + event/program type.

## Out of scope for Stage 2

- App Store / Play Store release
- Real Stripe charges
- Unrestricted team chat / Discord clone
- Sixth tab
- Sponsor marketplace
- Automatic FXA/CCPL sync
- Production push credentials
- Legal-final waiver text (keep labeled placeholder + versioning hook)
- Redesigning the five-tab skeleton or visual system

## Definition of done

A parent can: choose who they are, see **their** briefing, finish registration into a Season Hub that answers the seven post-checkout questions, RSVP and see field status, get a weather/closure alert, message a coach in a privacy-aware thread, and follow another Royals team this week as a supporter.

A coach/admin can: post an announcement, cancel/close a field, take attendance, and assign a child to a team without leaving the app’s staff surfaces.

The five-tab skeleton, visual language, youth privacy, demo mode, and Stage 1 registration quality are intact.

---

End of prompt.
