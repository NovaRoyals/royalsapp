# ROYALS

The cross-platform club app for Nova Royals Athletic Club. This first substantial MVP covers program discovery, a multi-child youth registration checkout, household profiles, schedules, attendance, teams, league tables, tournament entry, notifications, announcements, and initial staff tools.

## Run immediately (demo mode)

Requirements: Node.js 22.13 or newer and npm.

```bash
npm install
npm run web
```

Then open the URL printed by Expo (normally `http://localhost:8081`). No backend credentials are required. Demo registrations, attendance responses, role previews, status edits, results, and announcements persist in local storage.

Other platforms:

```bash
npm run android
npm run ios
```

The iOS command requires macOS/Xcode; Android requires an emulator or connected device. Expo Go support depends on SDK compatibility, while a development build supports the full notification configuration.

## Connect Supabase

1. Create a Supabase project.
2. Copy `.env.example` to `.env`.
3. Add the project URL and publishable key. Never use a secret/service-role key in the app.
4. Apply `supabase/migrations/20260913200157_core_schema.sql` to the project.
5. Generate database types and replace the temporary repository DTO casts before production launch.

For local Supabase development (Docker required):

```bash
npx supabase start
npx supabase db reset
```

The app automatically selects demo mode unless both public Supabase variables are present.

## Environment

```text
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
EXPO_PUBLIC_PAYMENT_MODE=demo
```

Public/publishable Supabase keys are safe in a client only because database RLS is mandatory. Payment provider secrets and Supabase service-role keys belong in server-side functions, never in Expo environment variables.

## Quality checks

```bash
npm run typecheck
npm run lint
```

## Structure

- `src/app/` — Expo Router screens and navigation
- `src/components/` — reusable design-system components
- `src/data/` — demo fixtures and repository abstraction
- `src/state/` — local interactive demo state
- `src/theme/` — athletic visual tokens
- `src/types/` — domain contracts
- `src/lib/` — backend setup
- `supabase/` — local config, SQL migrations, and seed entrypoint
- `docs/` — product, data, security, and assumption records

## Production gaps

Demo mode is fully navigable but is not a production backend. Supabase Auth screens, generated database types/mappers, server-side registration finalization, transactional payment webhooks, production push credentials, native calendar permissions, finalized legal waiver text, and approved/bundled club imagery still need configuration and validation.
