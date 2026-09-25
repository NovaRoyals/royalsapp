# Known technical issues

## WEB-001 — React hydration error #418 on persisted web routes

**Status:** Open. Block production web release.

**Summary:** Hard-refreshing persisted authenticated or demo-role routes on Expo static web logs React error #418 (server HTML does not match the client’s initial render). The most reliable reproduction is `/updates` after a sent U8 recap and a Parent / guardian preview. Functionality recovers on the client after mount, but the first markup differs.

**Reproduction (cleared site storage):**

1. Open `/onboarding`.
2. Complete mock Google onboarding and select Coach.
3. Load the seeded Coach / manager preview role.
4. Send the U8 session recap.
5. Switch to Parent / guardian.
6. Open `/updates`.
7. Hard-refresh `/updates`.

Also observed on other persisted routes after the same session.

**Constraint:** Do not attempt another speculative hydration fix in the current stage. Resolve WEB-001 deliberately before production web release.

### Regression-test TODO

Automate hard refreshes of the following routes after the seeded persisted flow, capture `console.error`, and fail if output contains `Hydration failed`, `didn't match`, or `Minified React error #418`:

- `/`
- `/profile`
- `/programs`
- `/updates`
