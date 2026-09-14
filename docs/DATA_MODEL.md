# ROYALS data model

The migration in `supabase/migrations/` is the authoritative initial schema. It is designed before screen implementation so soccer and cricket share stable concepts.

## Identity and households

- `auth.users` is owned by Supabase Auth.
- `profiles` contains private account/person data and has a one-to-one auth relationship.
- `user_roles` grants explicit application roles. Authorization never trusts editable user metadata.
- `households` stores a family address and is linked to one or more authorized accounts through `household_guardians`.
- `participants` represents a player independently of account status. A minor normally belongs to a household; an adult can later link to their own profile.

A child is not an auth user by default. Guardians manage child records through explicit household relationships. Public surfaces should derive a safe display name rather than selecting full name or date of birth.

## Programs and registration

- `sports` → `programs`, `teams`, `competitions`, and `events`.
- `seasons` groups date-bound programs and competitions.
- `programs` contains audience, dates, capacity, publication, registration status, and generic metadata.
- `program_pricing` supports standard, sibling, early-bird, team, and future pricing rules.
- `registrations` is the checkout aggregate with amounts, discount, status, payment state, submitter, and optional household.
- `registration_participants` provides per-player pricing and status.
- `waivers` versions immutable legal text.
- `consent_acceptances` snapshots the exact signed text, signer, timestamp, and signature.
- `payment_records` is provider-neutral and explicitly identifies demo records.

Registration finalization should become one server-side transaction/RPC that verifies participant authority, current prices, waiver versions, capacity, and totals. The client’s displayed calculation is never the production source of truth.

## Teams and competitions

- `teams` is a reusable club or entrant team.
- `team_memberships` links participants to teams, with role, jersey, position, dates, and status.
- `team_staff` grants scoped roster/schedule/publishing capabilities.
- `competitions` supports `league`, `tournament`, `friendly`, `pickup`, and `training`.
- `divisions` holds competition subdivisions and rule JSON.
- `competition_staff` grants scoped entry/fixture/result management.
- `competition_entries` registers a team into a competition/division and stores manager, fee, approval, seed, and group.
- `tournament_rosters` links an entry to participants and tracks eligibility, waivers, jersey numbers, and check-in.
- `bracket_config` is an extension point for bracket type, rounds, seeds, and progression.

## Schedule, results, and standings

- `events` is the unified calendar. It supports league/tournament matches, friendlies, training, open play, and club events.
- Match events can point to home/away Royals teams or use an external opponent label.
- Numeric home/away score handles common cases; `result_data` adds cricket innings, penalties, sets, or other sport-specific facts.
- `attendance` stores one participant response and the authorized account that made it.
- `standings` provides common played/won/drawn/lost/points/scored/conceded fields plus `sport_data` for sport-specific values and tie breakers.

## Communication

- `announcements` targets club, program, team, or competition audiences.
- `notifications` is the in-app delivery record for one recipient.
- `notification_preferences` stores channel preferences and an optional push token.

Chat tables are intentionally absent from the first migration. They should be added in an isolated migration after moderation, membership, retention, reporting, and youth visibility rules are approved.

## Key relationship summary

```text
auth.users 1—1 profiles 1—* user_roles
profiles *—* households (household_guardians)
households 1—* participants

sports 1—* programs 1—* registrations *—* participants
programs 1—* waivers
registrations 1—* consent_acceptances
registrations 1—* payment_records

sports 1—* teams *—* participants (team_memberships)
competitions 1—* divisions
competitions 1—* competition_entries *—1 teams
competition_entries 1—* tournament_rosters *—1 participants

programs/competitions 1—* events
events 1—* attendance
competitions 1—* standings
```

## Demo versus production data

`src/data/demo.ts` contains local product demonstration fixtures. Factual program facts are marked separately from invented sample teams, players, scores, venues, and tournaments. Production reads go through the repository boundary and must map generated Supabase database types into the domain contracts.
