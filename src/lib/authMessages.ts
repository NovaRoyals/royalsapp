/**
 * Everything about sign-in that needs no network: the words a parent reads when something goes
 * wrong, the checks on what they type, and how to read the link they come back through.
 */

export const MIN_PASSWORD = 8;

export type AuthErrorLike = { message?: string; code?: string; status?: number; name?: string } | null | undefined;

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** An empty string means the password is fine. */
export function passwordProblem(password: string) {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use letters and at least one number.';
  return '';
}

const CODE_WORDS: Record<string, string> = {
  invalid_credentials: 'That email and password don’t match. Check them, or reset your password.',
  user_already_exists: 'There’s already an account with that email. Try signing in instead.',
  email_exists: 'There’s already an account with that email. Try signing in instead.',
  weak_password: 'Choose a stronger password: at least 8 characters, with letters and a number.',
  email_not_confirmed: 'Confirm your email first. We sent you a link.',
  over_email_send_rate_limit: 'We’ve sent a lot of emails just now. Wait a little while and try again.',
  over_request_rate_limit: 'Too many tries in a short time. Wait a minute and try again.',
  email_address_invalid: 'That email address doesn’t look right.',
  validation_failed: 'That doesn’t look right. Check what you entered.',
  signup_disabled: 'New accounts are switched off right now. Please ask the club.',
  provider_disabled: 'Google sign-in isn’t switched on yet. Use email for now.',
  same_password: 'Choose a password you haven’t used for this account before.',
  otp_expired: 'That link has expired. Ask for a new one.',
  flow_state_not_found: 'That link has expired. Ask for a new one.',
  session_expired: 'You’ve been signed out. Sign in again.',
  user_banned: 'This account can’t sign in. Please contact the club.',
};

const NETWORK = /failed to fetch|network request failed|networkerror|load failed|timeout|timed out|fetch failed/i;
const FALLBACK = 'Something went wrong. Please try again.';

export function authMessage(error: AuthErrorLike): string {
  if (!error) return FALLBACK;
  const code = (error.code ?? '').toLowerCase();
  if (code && Object.prototype.hasOwnProperty.call(CODE_WORDS, code)) return CODE_WORDS[code];
  const text = error.message ?? '';
  // Older servers answer in sentences rather than codes.
  if (/invalid login credentials/i.test(text)) return CODE_WORDS.invalid_credentials;
  if (/already registered|already been registered/i.test(text)) return CODE_WORDS.user_already_exists;
  if (/email not confirmed/i.test(text)) return CODE_WORDS.email_not_confirmed;
  if (/rate limit/i.test(text) || error.status === 429) return CODE_WORDS.over_request_rate_limit;
  if (/unsupported provider|provider is not enabled/i.test(text)) return CODE_WORDS.provider_disabled;
  if (/expired|invalid.*(link|token)/i.test(text)) return CODE_WORDS.otp_expired;
  if (error.name === 'AuthRetryableFetchError' || NETWORK.test(text)) return 'Can’t reach the club’s servers. Check your connection and try again.';
  return FALLBACK;
}

export type CallbackResult =
  | { kind: 'session'; accessToken: string; refreshToken: string; type: string | null }
  | { kind: 'code'; code: string }
  | { kind: 'error'; message: string }
  | { kind: 'none' };

/**
 * Read the address a sign-in or email link sends the person back to. The details can be in the
 * query (`?code=…`) or, for the default flow, in the fragment (`#access_token=…`).
 */
export function parseAuthCallback(url: string): CallbackResult {
  if (!url) return { kind: 'none' };
  const hashAt = url.indexOf('#');
  const queryAt = url.indexOf('?');
  const query = queryAt >= 0 ? url.slice(queryAt + 1, hashAt >= 0 && hashAt > queryAt ? hashAt : undefined) : '';
  const hash = hashAt >= 0 ? url.slice(hashAt + 1) : '';
  const params = new URLSearchParams(hash.includes('=') ? `${query}&${hash}` : query);

  const error = params.get('error_code') || params.get('error');
  if (error) {
    const description = params.get('error_description') ?? '';
    if (error === 'access_denied' && !/expired|invalid/i.test(description)) return { kind: 'error', message: 'Sign-in was cancelled.' };
    return { kind: 'error', message: authMessage({ code: params.get('error_code') ?? undefined, message: description || error }) };
  }
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'session', accessToken, refreshToken, type: params.get('type') };
  const code = params.get('code');
  if (code) return { kind: 'code', code };
  return { kind: 'none' };
}
