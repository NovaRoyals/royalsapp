# ROYALS product definition

## Product intent

ROYALS is the primary digital home of Nova Royals Athletic Club, not a website wrapper. It lets a new visitor understand the club, a parent reuse household profiles across seasons, an adult player manage competition commitments, and authorized staff operate core club workflows.

Brand voice is direct, warm, athletic, and community-first. The product name is always ROYALS; “Nova Royals Athletic Club” supplies organizational context.

## Users and role-aware priorities

- Guest: discover programs, selected fixtures/results, events, and club identity without an account.
- Adult player: profile, registrations, team, next match, RSVP, recent result, and standings.
- Parent/guardian: a private household, reusable child profiles, registration status, payments, and each child’s next activity.
- Coach/team manager: authorized roster, attendance, fixtures, results, and team announcements.
- Competition manager: authorized entries, eligibility, squads, check-in, fixtures, results, groups, and brackets.
- Club administrator: explicit broad access to club operations.

Roles affect capability, not permanent sport segmentation. Users can follow soccer, cricket, programs, and teams after onboarding.

## Navigation

Five durable destinations:

1. Home — contextual next action and club pulse.
2. Programs — sport-filtered discovery and registration entry.
3. Schedule — one calendar for training, matches, open play, and club events.
4. Teams — squad, attendance, competition, results, and standings.
5. Profile — identity, household, registrations, payments, consents, settings, and staff entry.

Notifications use the header bell. Program, event, team, competition, onboarding, registration, and admin routes sit above the tabs.

## MVP feature architecture

### Home

Guest home combines a concise brand statement, active Fall Soccer Training registration, and **This Week at ROYALS**. Signed-in home is a **personal briefing**: next child/team commitment, field status, unread announcements, payment/season hub, supporter RSVP. Community lives on Home, not a sixth tab.

### Programs and registration

Programs are sport-filtered and program-aware. Youth registration is a seven-state consumer checkout, then a durable **Season Hub** (confirmation, payment, assignment, coach, first session, calendar, waiver, contact coach).

1. program overview;
2. parent/household;
3. select or add children;
4. participation and emergency consent;
5. review;
6. payment/status;
7. confirmation.

Pricing is computed per participant: $120 for the first child and $60 per additional sibling for the factual Fall Soccer Training 2026 offer. Adult programs receive an adult player form rather than youth/guardian fields. Tournament team entry is a distinct competition flow.

### Shared competition model

League, tournament, friendly, pickup, and training are competition contexts, while scheduled records identify a concrete event type. Soccer and cricket share teams, entries, squads, events, attendance, results, and extensible JSON sport data.

External leagues can be labeled and linked without presenting ROYALS as their official system. Tournament entries add approval, eligibility, waiver, check-in, group, seed, and bracket configuration.

### Communication

Announcements support club, program, and team audiences with urgency (urgent / high / normal / low). Parents can reply on a team announcement or DM a coach. Unrestricted group chat is excluded.

### Admin

The initial role-protected management route reviews registration status, publishes announcements, inspects teams/rosters, and edits demo results. Database authorization remains the source of truth. The domain/repository boundary can also support a separate admin web application later.

## Experience principles

- One obvious next action per major state.
- Progressive profiling instead of a long onboarding form.
- Never make families retype stable child or household details.
- Clearly mark invented demo competition data.
- Keep private youth data out of public surfaces.
- Use orange for action and club moments, not as decoration everywhere.
- Compact useful cards, strong type, restrained radius, and accessible 44–52px controls.

## Roadmap

### Next

- Complete Supabase Auth, email verification deep links, DTO mapping, and transactional registration RPC.
- Integrate a server-side payment provider with webhook reconciliation and receipts.
- Approve and bundle club-owned photography, logo, and final font licenses.
- Enable native calendar write permission and production push registration.
- Add program/session administration and capacity/waitlist automation.

### Later

- Competition import/sync for external leagues.
- Cricket scorecards and sport-specific standings rules.
- Group generation, bracket seeding, progression, and field conflict tools.
- Team chat as an isolated, moderated, youth-safe feature.
- Volunteer, donor, and community event workflows.
- Coach availability, player development notes, and check-in scanning.
