# Sign-in

Parents, players and coaches can sign up and sign in with **email and password** or **Google**. Everything here switches on only when the app has a Supabase project (`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Without one, the app stays in demo mode and the welcome screens behave as before.

## What it does

- **Sign up with email.** Email, a password (8+ characters, letters and a number), name, and how you relate to the club. The account is created when the last question is answered. If the project requires confirming email, a "Check your email" screen takes over (with resend).
- **Sign in with email.** A wrong password and an unknown email give the same plain answer. "Forgot your password?" sends a link; the link comes back to the app and asks for a new password.
- **Google.** The button asks the project whether Google is switched on and says so in a sentence if it is not.
- **Returning.** Someone whose account already has a name and role goes straight to Home. The session survives restarts. **Sign out** is on Profile.
- **The account's profile** is created by the database when someone signs up, with names read from either sign-up method. A new account only ever gets the `supporter` role. Coaches, managers and admins are assigned by an admin, never by anything typed at sign-up. "Parent", "coach" and so on are saved as a preference and decide nothing.
- **Honest labels.** With a project connected the corner label reads "Accounts live · data on device", because registrations, messages and announcements are not on the server yet.

## Where it lives

| Piece | File |
| --- | --- |
| Wording of every error, password and link rules | `src/lib/authMessages.ts` |
| Sign up, sign in, Google, links, reset, sign out (database client passed in) | `src/lib/authService.ts` |
| The app's instance, with browser and Google plumbing | `src/services/account.ts` |
| Who is signed in, remembered | `src/state/AccountProvider.tsx` |
| Where email links and Google return | `src/app/auth/callback.tsx`, `src/app/auth/reset.tsx` |
| Welcome flow | `src/app/onboarding.tsx` |
| Profile names and the "supporter only" rule | `supabase/migrations/20261004100000_auth_profile_names.sql` |

Tests: `tests/auth.test.ts` (33) and `npm run db:test:auth`.

## Tested, and how

Run against the local database in the browser: sign-up, weak password refused, wrong password, sign-in, the session surviving a full reload, sign-out clearing the stored login, a returning sign-in skipping the questions, Google refused politely. The server's real answers for duplicate email, wrong password and weak password were checked against the wording.

## Not tested yet

- **Google sign-in end to end.** Needs the Google credential below.
- **Confirmation and reset emails.** Locally there is no mail catcher; on the hosted project the built-in sender allows 2 emails an hour (for testing only). The code path is unit-tested; a real email has not been sent.
- **The phone app's return link** (`royals://auth/callback`, or the Expo Go link). Web only so far.

## To switch on Google (your steps)

Google Cloud now blocks any account without 2-step verification, so first turn it on for the club's Google account (myaccount.google.com → Security → 2-Step Verification).

1. Google Cloud console → create a project (no billing needed for sign-in; skip the free-trial offer).
2. Google Auth Platform → set up the consent screen: External, app name "NOVA Royals", the club's support email, and only the basic scopes (`openid`, `email`, `profile`).
3. Create an OAuth client of type **Web application**. Authorised JavaScript origins: the app's web address(es). Authorised redirect URI: `https://mvgzkxlekyoxmdaeupgo.supabase.co/auth/v1/callback`.
4. In the Supabase dashboard → Authentication → Sign In / Providers → Google: switch on, paste the Client ID and Client Secret.
5. Authentication → URL Configuration: set the Site URL to the app's web address and add the Redirect URLs `http://localhost:8083/**`, the deployed web address with `/**`, `royals://**` and `exp://**`.
6. While the consent screen is in "Testing", only listed test users can sign in. Publish it to production before parents use it; with only the basic scopes Google does not need to review it.

Apple sign-in is hidden for now. Apple requires it only for apps in the App Store that offer Google, so it comes later, with the store release.
