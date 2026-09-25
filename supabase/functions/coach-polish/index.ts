/**
 * TODO(server): Deploy as Supabase Edge Function `coach-polish`.
 *
 * Secrets (Dashboard → Edge Functions → Secrets, never in git):
 *   OPENROUTER_API_KEY
 *
 * Intended request (JSON):
 *   { recapId, original, mode, sessionLabel }
 *
 * Must:
 *   1. Authenticate JWT
 *   2. Confirm membership_role = coach for the session's team
 *   3. Strip child names before calling OpenRouter
 *   4. Ask for structured { text, rejectedClaims }
 *   5. Rate-limit
 *   6. Write coach_polish_logs (original + generated)
 *   7. Return generated text only — never send to families
 */
export {};
