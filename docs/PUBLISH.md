# Publishing the app: the plan

Written 2026-10-07. Three tracks run side by side. The slow ones are the ones that wait on people and approvals, so they start first.

## Track A. Accounts and approvals (start now, mostly waiting)

| Item | Who | Notes |
| --- | --- | --- |
| Apple Developer Program, as an organization | Club signer, with me guiding | Legal name **Nova Royals Athletic Club**, EIN 88-1537444, D-U-N-S **07-614-5506** (already exists at Dun & Bradstreet), address 40851 Tulip Poplar Pl, Aldie, VA 20105. Needs a work email on the club's own website domain, a real website (novaroyalsac.com) and the signer's authority. **Risk:** the club's email today is infonovaroyals@gmail.com, which is not on the domain, and Apple's rule is that the contact email must be associated with the organization's domain. If Apple rejects the Gmail address, create an address on novaroyalsac.com (for example through Google Workspace for Nonprofits, which is free for eligible 501(c)(3)s, or the domain host's email) and enrol with that. Apple verifies by phone or email, usually days. |
| Apple fee waiver | Same signer | Nonprofits recognised by the IRS (501(c)(3)) can have the $99 waived. Apple may ask for the IRS determination letter. Only valid while the app sells no digital goods, which fits us: registrations are real-world services. |
| Google Play organization account | Same signer | $25 one time, also needs the D-U-N-S number. Verification can take a few days. |
| Email address on the club's domain | Whoever runs the domain | May be needed by Apple (see the risk above), and by Resend to send sign-in emails from the club's own address. |
| Resend (email sending) | You, then me | Free tier. Needs DNS records on novaroyalsac.com. Replaces Supabase's 2-an-hour test sender. |
| Google sign-in published | You approve, I do it | Consent screen is in Testing; it must be published before parents use it. Only basic scopes, so no review. |
| Stripe live mode | You, deliberately, last | Everything is built and tested in test mode. Going live means entering live keys on purpose and turning on `STRIPE_ALLOW_LIVE`. Decide how the website's own Stripe checkout and the app share the one account. |

## Track B. Build (me)

1. **Connect the app's data to the database.** Today registrations, messages, announcements and recaps live on each device. Slices, each tested before the next:
   1. household and children;
   2. registration and the approval flow, then paying from the screen;
   3. messaging (chat, parent chat, block and report);
   4. announcements and notification priority, with a migration for the richer announcement model;
   5. schedule, attendance and coach recaps, including the AI polish button.
2. **Store requirements the stores check.**
   - Account deletion inside the app (required when an app lets people sign up).
   - A public privacy policy page, covering children's information, and a terms page.
   - Sign in with Apple, since Google sign-in is offered on iPhone.
   - A reviewer login that works without email confirmation.
   - Push notifications set up with Apple and Google keys; realtime chat.
   - Support page and contact address.
3. **Build setup.** An `eas.json` with development, preview and production profiles; app name and icons for the stores; version and build numbers; `eas build` for iOS and Android; TestFlight and Google internal testing.
4. **Known issue to fix first:** the web refresh error WEB-001 (`docs/known-issues.md`).

## Track C. Launch

1. A closed test: about ten families and the coaches, through TestFlight and Google's internal test track, for a couple of weeks.
2. Store listing: name, subtitle, description, screenshots, age rating, privacy answers ("App Privacy" labels), support URL.
3. Submit. Apple review is typically a day or two but can bounce for missing items; the list in Track B is meant to avoid that.
4. Website: the "Register now" buttons open the app's web registration, so there is one registration system and nothing to sync.
5. Supabase moves to the Pro plan ($25 a month) the day real registrations start, for backups and no pausing.

## Order of work

Start Track A today because it waits on people. Do Track B 1.1 to 1.3 first (family, registration, payment), since that is what parents need on day one. Messaging and announcements follow. The store requirements in B2 are small and can be built in parallel with 1.4 and 1.5. A closed test can begin as soon as B1.1 to B1.3 and B2 are done; I would not wait for everything.

## Decided (2026-10-07)

- **Legal signer:** Ambika Sapkota. A club cannot sign for itself; Apple and Google need one named person with the authority to bind Nova Royals Athletic Club, and that person becomes the Account Holder.
- **Store name:** "Nova Royals" (not "NOVA").
- **Website:** moving the Register buttons to the app is a later job.

## Apple enrollment, step by step (for the signer)

1. Create a club Apple ID at appleid.apple.com with the club's email (today infonovaroyals@gmail.com) and turn on two-factor sign-in. It should be a club Apple ID, not a personal one, so the account survives people changing roles. If Apple later insists on an address at novaroyalsac.com, make that address first and use it instead.
2. Go to developer.apple.com/programs/enroll and sign in with that Apple ID.
3. Choose **Organization**, then the type for a nonprofit.
4. Enter the legal name exactly: **Nova Royals Athletic Club**; D-U-N-S **07-614-5506**; address 40851 Tulip Poplar Pl, Aldie, VA 20105; website https://www.novaroyalsac.com; the club phone number.
5. Confirm the signer has legal authority (for example founder, president or director) and enter their details.
6. Choose the **fee waiver** option when asked. Have the IRS determination letter (the 501(c)(3) letter, ruling year 2022, EIN 88-1537444) ready as a PDF in case Apple asks for it.
7. Apple verifies the organization, often by phone or email to the signer, then approves. This is the slow step: allow days, sometimes longer.
8. When approved, invite the club's app developer account as an App Manager so builds can be uploaded.

Google Play is similar: play.google.com/console, create an organization account, $25, the same legal details and D-U-N-S, then identity verification.

## What the club needs to decide

- Season length: 11 Sundays on the calendar against 12 sessions implied by $10 × 12.
- Whether coaches may cancel directly (`COACH_MAY_CANCEL`).
