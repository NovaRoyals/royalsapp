# ROYALS security and youth privacy

## Security posture

The client uses only a Supabase publishable key. Service-role, payment-provider, webhook, and administrative secrets must remain in server-side functions or deployment secrets. UI hiding improves usability but is never treated as authorization.

Every public-schema table has RLS enabled and forced in the initial migration. Public/anonymous reads are limited to intentionally published discovery records. Sensitive tables have no anonymous grant.

Authorization roles are stored in `user_roles`, not `auth.users.raw_user_meta_data`. User metadata may initialize a display name but must never grant access. Administrative and scoped capability checks live in non-exposed `private` schema security-definer functions with an empty `search_path`.

## Access model

- Guests: active sports/teams and published programs, competitions, events, standings, pricing, waivers, and club announcements.
- Account owner: own profile, notifications, and preferences.
- Guardian: households and participants reachable through an explicit `household_guardians` row with `can_manage`.
- Adult player: their profile-linked participant, registrations, memberships, attendance, and authorized team content.
- Team staff: only teams present in `team_staff`; capability columns scope roster, schedule, and publishing actions.
- Competition staff: only competitions present in `competition_staff`; capability columns scope entries, fixtures, and results.
- Club admin: explicit `club_admin` role with operational access.

## Minor data

Child accounts are not required. A child participant normally belongs to a guardian-managed household.

Never publish:

- full date of birth;
- address;
- guardian email or phone;
- medical or emergency information;
- typed signature or waiver evidence;
- internal registration notes;
- an identifiable public youth roster.

The mobile domain exposes a `displayName` suitable for roster UI. Production queries should use a security-invoker safe projection/RPC that emits only the fields required by the caller. Coaches may need operational details for their assigned teams, but this does not imply broad club access.

Youth communication is private by default. Public chat is out of scope. Any future team chat must verify active membership/guardian authority for every read and write, provide staff moderation/reporting, define retention, prevent discoverability, and avoid exposing child contact details.

## Registration and consent

- Stable household and participant records are reused; each registration stores only the relevant references and checkout snapshot.
- Production totals must be recomputed server-side from active pricing records. A malicious client must not choose its own discount or amount.
- Waiver acceptances snapshot exact text/version, signer, participants, signature, and timestamp.
- Signatures and medical/emergency fields are sensitive records, not announcement or roster data.
- Registration finalization should use a transaction to prevent partial participants/consents/payment state.
- Audit events and retention/deletion rules should be approved with counsel before launch.

The consent copy in the app and demo migration is product placeholder language, not legal advice. Approved club wording must be versioned before real enrollment.

## Payments

No production payment is simulated. Demo checkout writes only local `pending` state. A production provider integration requires:

1. server-created checkout/payment intent;
2. server-side amount calculation;
3. signed webhook verification;
4. idempotent payment reconciliation;
5. receipt/refund records;
6. no card data stored by ROYALS.

## Auth and sessions

- Supabase Auth session storage is currently isolated behind the backend client.
- Before release, use the current Supabase-recommended encrypted React Native session adapter, email verification deep links, short-lived recovery links, and tested sign-out.
- Sensitive operations should consider JWT freshness; deleting a user alone does not invalidate issued tokens.
- Staff role changes should force session refresh and be audited.

## Storage

Club-owned public program imagery can use a public bucket. Participant/guardian uploads require private buckets and path policies keyed to household/team authorization. Upsert policies need select, insert, and update permissions; these are intentionally deferred until an upload workflow exists.

## Verification checklist before launch

- Run local migrations and database tests against anon, guardian, unrelated guardian, player, team manager, competition manager, and admin identities.
- Confirm UPDATE policies also have required SELECT visibility.
- Run Supabase security/performance advisors.
- Generate and use typed database contracts.
- Pen-test registration totals, IDORs, role changes, roster reads, consent reads, and staff routes.
- Review privacy policy, COPPA-related assumptions, consent wording, retention, incident response, and vendor agreements with qualified counsel.
