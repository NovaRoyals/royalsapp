import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { authMessage, isEmail, parseAuthCallback, passwordProblem } from '../src/lib/authMessages.ts';
import { createAuthService, summarizeUser, type AuthClient, type AuthEnv } from '../src/lib/authService.ts';

describe('what a parent reads when sign-in goes wrong', () => {
  it('turns the server’s codes and sentences into plain words', () => {
    assert.match(authMessage({ code: 'invalid_credentials' }), /don’t match/);
    assert.match(authMessage({ message: 'Invalid login credentials' }), /don’t match/);
    assert.match(authMessage({ message: 'User already registered' }), /already an account/);
    assert.match(authMessage({ code: 'weak_password' }), /stronger password/);
    assert.match(authMessage({ code: 'email_not_confirmed' }), /Confirm your email/);
    assert.match(authMessage({ code: 'over_email_send_rate_limit' }), /Wait a little/);
    assert.match(authMessage({ status: 429, message: 'x' }), /Too many tries/);
    assert.match(authMessage({ message: 'Unsupported provider: provider is not enabled' }), /Google sign-in isn’t switched on/);
    assert.match(authMessage({ message: 'Email link is invalid or has expired' }), /expired/);
  });

  it('says so plainly when the servers cannot be reached, and never shows raw errors', () => {
    assert.match(authMessage({ name: 'AuthRetryableFetchError', message: 'x' }), /Can’t reach/);
    assert.match(authMessage({ message: 'Failed to fetch' }), /Can’t reach/);
    const odd = authMessage({ message: 'duplicate key value violates unique constraint "users_pkey"' });
    assert.equal(odd, 'Something went wrong. Please try again.');
    assert.equal(authMessage(null), 'Something went wrong. Please try again.');
  });
});

describe('checking what is typed', () => {
  it('knows an email from a non-email', () => {
    assert.ok(isEmail(' jordan@example.com '));
    assert.ok(!isEmail('jordan@'));
    assert.ok(!isEmail('jordan example.com'));
  });

  it('asks for eight characters with letters and a number', () => {
    assert.equal(passwordProblem('Sunday2026'), '');
    assert.match(passwordProblem('short1'), /at least 8/);
    assert.match(passwordProblem('onlyletters'), /letters and at least one number/);
    assert.match(passwordProblem('12345678'), /letters and at least one number/);
  });
});

describe('reading the address someone comes back through', () => {
  it('finds a session in the fragment', () => {
    const url = 'http://localhost:8083/auth/callback#access_token=AAA&refresh_token=BBB&expires_in=3600&token_type=bearer&type=recovery';
    assert.deepEqual(parseAuthCallback(url), { kind: 'session', accessToken: 'AAA', refreshToken: 'BBB', type: 'recovery' });
    assert.deepEqual(parseAuthCallback('royals://auth/callback#access_token=A&refresh_token=B'), { kind: 'session', accessToken: 'A', refreshToken: 'B', type: null });
  });

  it('finds a code in the query', () => {
    assert.deepEqual(parseAuthCallback('https://x.test/auth/callback?code=abc123'), { kind: 'code', code: 'abc123' });
  });

  it('turns a cancelled sign-in and an expired link into plain sentences', () => {
    assert.deepEqual(parseAuthCallback('royals://auth/callback#error=access_denied&error_description=User+cancelled'), { kind: 'error', message: 'Sign-in was cancelled.' });
    const expired = parseAuthCallback('https://x.test/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    assert.equal(expired.kind, 'error');
    assert.match((expired as { message: string }).message, /expired/);
  });

  it('reports nothing for an address with no sign-in in it', () => {
    assert.deepEqual(parseAuthCallback('https://x.test/auth/callback'), { kind: 'none' });
    assert.deepEqual(parseAuthCallback(''), { kind: 'none' });
    assert.deepEqual(parseAuthCallback('https://x.test/?access_token=only-one'), { kind: 'none' });
  });
});

describe('who someone says they are', () => {
  it('reads names from email sign-up and from Google', () => {
    const email = summarizeUser({ id: '1', email: 'j@x.test', user_metadata: { first_name: 'Jordan', last_name: 'Cole', relationship: 'parent' } });
    assert.deepEqual(email, { id: '1', email: 'j@x.test', firstName: 'Jordan', lastName: 'Cole', relationship: 'parent' });
    const google = summarizeUser({ id: '2', email: 's@x.test', user_metadata: { full_name: 'Sam Lee Jr', given_name: 'Sam', family_name: 'Lee Jr' } });
    assert.equal(google.firstName, 'Sam');
    assert.equal(google.lastName, 'Lee Jr');
    const onlyFull = summarizeUser({ id: '3', email: 'p@x.test', user_metadata: { name: 'Priya Rao' } });
    assert.deepEqual([onlyFull.firstName, onlyFull.lastName], ['Priya', 'Rao']);
  });

  it('ignores a relationship it does not know', () => {
    assert.equal(summarizeUser({ id: '4', email: 'a@x.test', user_metadata: { relationship: 'admin' } }).relationship, null);
    assert.equal(summarizeUser({ id: '5', email: 'a@x.test', user_metadata: undefined as never }).relationship, null);
  });
});

// ---------------------------------------------------------------------------------------
// The service, with a fake database client
// ---------------------------------------------------------------------------------------
const user = (patch: Record<string, unknown> = {}) => ({ id: 'u1', email: 'jordan@example.com', user_metadata: { first_name: 'Jordan', last_name: 'Cole' }, identities: [{}], ...patch });

function fake(patch: Partial<AuthClient['auth']> = {}) {
  const calls: Record<string, unknown[]> = {};
  const record = (name: string, value: unknown) => ((calls[name] ??= []).push(value), value);
  const auth: AuthClient['auth'] = {
    signUp: async (args) => (record('signUp', args), { data: { user: user() as never, session: null }, error: null }),
    signInWithPassword: async (args) => (record('signIn', args), { data: { user: user() as never, session: {} as never }, error: null }),
    signInWithOAuth: async (args) => (record('oauth', args), { data: { url: 'https://accounts.google.test/auth' }, error: null }),
    setSession: async (args) => (record('setSession', args), { data: { user: user() as never }, error: null }),
    exchangeCodeForSession: async (code) => (record('exchange', code), { data: { user: user() as never }, error: null }),
    resetPasswordForEmail: async (email, options) => (record('reset', { email, options }), { error: null }),
    resend: async (args) => (record('resend', args), { error: null }),
    updateUser: async (args) => (record('update', args), { data: { user: user() as never }, error: null }),
    signOut: async () => (record('signOut', true), { error: null }),
    ...patch,
  };
  return { client: { auth }, calls };
}

const web: AuthEnv = { isWeb: true, redirectUrl: () => 'http://localhost:8083/auth/callback' };
const native = (open: AuthEnv['openBrowser']): AuthEnv => ({ isWeb: false, redirectUrl: () => 'royals://auth/callback', openBrowser: open });
const SIGNUP = { email: ' Jordan@Example.com ', password: 'Sunday2026', firstName: ' Jordan ', lastName: 'Cole', relationship: 'parent' as const };

describe('signing up', () => {
  it('sends a tidy email, the name, and where the confirmation link should return', async () => {
    const { client, calls } = fake();
    const result = await createAuthService(client, web).signUp(SIGNUP);
    assert.deepEqual(result, { ok: true, status: 'confirm-email', email: 'jordan@example.com' });
    const sent = calls.signUp[0] as { email: string; options: { emailRedirectTo: string; data: Record<string, unknown> } };
    assert.equal(sent.email, 'jordan@example.com');
    assert.equal(sent.options.emailRedirectTo, 'http://localhost:8083/auth/callback');
    assert.deepEqual(sent.options.data, { first_name: 'Jordan', last_name: 'Cole', display_name: 'Jordan Cole', relationship: 'parent' });
  });

  it('signs straight in when no confirmation is needed', async () => {
    const { client } = fake({ signUp: async () => ({ data: { user: user() as never, session: {} as never }, error: null }) });
    const result = await createAuthService(client, web).signUp(SIGNUP);
    assert.equal(result.ok && result.status, 'signed-in');
    assert.equal(result.ok && result.status === 'signed-in' && result.user.firstName, 'Jordan');
  });

  it('says "already an account" when the server hides it behind an empty identity list', async () => {
    const { client } = fake({ signUp: async () => ({ data: { user: user({ identities: [] }) as never, session: null }, error: null }) });
    const result = await createAuthService(client, web).signUp(SIGNUP);
    assert.deepEqual(result, { ok: false, message: authMessage({ code: 'user_already_exists' }) });
  });

  it('refuses a bad email or a weak password before asking the server', async () => {
    const { client, calls } = fake();
    const service = createAuthService(client, web);
    assert.deepEqual(await service.signUp({ ...SIGNUP, email: 'nope' }), { ok: false, message: 'Enter a valid email address.' });
    const weak = await service.signUp({ ...SIGNUP, password: 'abc' });
    assert.equal(weak.ok, false);
    assert.equal(calls.signUp, undefined);
  });

  it('shows the server’s refusal in plain words', async () => {
    const { client } = fake({ signUp: async () => ({ data: {}, error: { code: 'over_email_send_rate_limit', status: 429 } }) });
    const result = await createAuthService(client, web).signUp(SIGNUP);
    assert.deepEqual(result, { ok: false, message: authMessage({ code: 'over_email_send_rate_limit' }) });
  });

  it('survives the network throwing', async () => {
    const { client } = fake({ signUp: async () => { throw new TypeError('Failed to fetch'); } });
    const result = await createAuthService(client, web).signUp(SIGNUP);
    assert.equal(result.ok, false);
    assert.match((result as { message: string }).message, /Can’t reach/);
  });
});

describe('signing in', () => {
  it('signs in with a tidy email', async () => {
    const { client, calls } = fake();
    const result = await createAuthService(client, web).signIn({ email: ' Jordan@Example.com', password: 'Sunday2026' });
    assert.equal(result.ok && result.status, 'signed-in');
    assert.deepEqual(calls.signIn[0], { email: 'jordan@example.com', password: 'Sunday2026' });
  });

  it('gives the same plain answer for a wrong password and an unknown email', async () => {
    const { client } = fake({ signInWithPassword: async () => ({ data: {}, error: { code: 'invalid_credentials', message: 'Invalid login credentials' } }) });
    const result = await createAuthService(client, web).signIn({ email: 'a@b.co', password: 'whatever1' });
    assert.deepEqual(result, { ok: false, message: authMessage({ code: 'invalid_credentials' }) });
  });

  it('asks for a password rather than sending an empty one', async () => {
    const { client, calls } = fake();
    assert.deepEqual(await createAuthService(client, web).signIn({ email: 'a@b.co', password: '' }), { ok: false, message: 'Enter your password.' });
    assert.equal(calls.signIn, undefined);
  });
});

describe('Google', () => {
  it('on the web hands the page over to Google and says so', async () => {
    const { client, calls } = fake();
    const result = await createAuthService(client, web).google();
    assert.deepEqual(result, { ok: true, status: 'redirecting' });
    const args = calls.oauth[0] as { provider: string; options: { redirectTo: string; skipBrowserRedirect: boolean; queryParams: { prompt: string } } };
    assert.equal(args.provider, 'google');
    assert.equal(args.options.skipBrowserRedirect, false);
    assert.equal(args.options.redirectTo, 'http://localhost:8083/auth/callback');
    assert.equal(args.options.queryParams.prompt, 'select_account');
  });

  it('in the app opens the browser, then finishes from the address it returns', async () => {
    const { client, calls } = fake();
    let opened = '';
    const service = createAuthService(client, native(async (url, back) => ((opened = `${url}|${back}`), { type: 'success', url: 'royals://auth/callback#access_token=A&refresh_token=B' })));
    const result = await service.google();
    assert.equal(opened, 'https://accounts.google.test/auth|royals://auth/callback');
    assert.equal(result.ok && result.status, 'signed-in');
    assert.deepEqual(calls.setSession[0], { access_token: 'A', refresh_token: 'B' });
  });

  it('treats closing the browser as cancelling', async () => {
    const { client } = fake();
    const result = await createAuthService(client, native(async () => ({ type: 'cancel' }))).google();
    assert.deepEqual(result, { ok: false, message: 'Google sign-in was cancelled.' });
  });

  it('checks first, and never leaves the page, when the project has Google switched off', async () => {
    const { client, calls } = fake();
    const result = await createAuthService(client, { ...web, googleEnabled: async () => false }).google();
    assert.deepEqual(result, { ok: false, message: authMessage({ code: 'provider_disabled' }) });
    assert.equal(calls.oauth, undefined);
    const unknown = fake();
    const proceeds = await createAuthService(unknown.client, { ...web, googleEnabled: async () => { throw new Error('offline'); } }).google();
    assert.deepEqual(proceeds, { ok: true, status: 'redirecting' });
    const on = fake();
    assert.deepEqual(await createAuthService(on.client, { ...web, googleEnabled: async () => true }).google(), { ok: true, status: 'redirecting' });
  });

  it('explains plainly when Google is not switched on for the project', async () => {
    const { client } = fake({ signInWithOAuth: async () => ({ data: {}, error: { message: 'Unsupported provider: provider is not enabled' } }) });
    const result = await createAuthService(client, web).google();
    assert.deepEqual(result, { ok: false, message: authMessage({ code: 'provider_disabled' }) });
  });
});

describe('coming back through an email link', () => {
  it('finishes a confirmation or a reset from the fragment, and flags a reset', async () => {
    const { client } = fake();
    const service = createAuthService(client, web);
    const confirm = await service.applyCallback('http://x.test/auth/callback#access_token=A&refresh_token=B&type=signup');
    assert.equal(confirm.ok && confirm.status === 'signed-in' && confirm.recovery, false);
    const reset = await service.applyCallback('http://x.test/auth/callback#access_token=A&refresh_token=B&type=recovery');
    assert.equal(reset.ok && reset.status === 'signed-in' && reset.recovery, true);
  });

  it('exchanges a code and refuses an address with nothing in it', async () => {
    const { client, calls } = fake();
    const service = createAuthService(client, web);
    assert.equal((await service.applyCallback('http://x.test/auth/callback?code=zzz')).ok, true);
    assert.equal(calls.exchange[0], 'zzz');
    const nothing = await service.applyCallback('http://x.test/auth/callback');
    assert.deepEqual(nothing, { ok: false, message: 'That link didn’t work. Try signing in again.' });
  });

  it('shows an expired link as expired', async () => {
    const { client } = fake();
    const result = await createAuthService(client, web).applyCallback('http://x.test/#error=access_denied&error_code=otp_expired&error_description=expired');
    assert.equal(result.ok, false);
    assert.match((result as { message: string }).message, /expired/);
  });
});

describe('the other account actions', () => {
  it('resends the confirmation to a tidy address', async () => {
    const { client, calls } = fake();
    assert.deepEqual(await createAuthService(client, web).resendConfirmation(' Jordan@Example.com '), { ok: true, status: 'sent' });
    assert.deepEqual(calls.resend[0], { type: 'signup', email: 'jordan@example.com', options: { emailRedirectTo: 'http://localhost:8083/auth/callback' } });
  });

  it('answers a password reset the same way whether or not the account exists', async () => {
    const unknown = fake({ resetPasswordForEmail: async () => ({ error: { message: 'User not found', status: 400 } }) });
    assert.deepEqual(await createAuthService(unknown.client, web).forgotPassword('nobody@example.com'), { ok: true, status: 'sent' });
    const real = fake();
    assert.deepEqual(await createAuthService(real.client, web).forgotPassword('jordan@example.com'), { ok: true, status: 'sent' });
    const limited = fake({ resetPasswordForEmail: async () => ({ error: { message: 'email rate limit exceeded', status: 429 } }) });
    assert.equal((await createAuthService(limited.client, web).forgotPassword('jordan@example.com')).ok, false);
    assert.deepEqual(await createAuthService(real.client, web).forgotPassword('nope'), { ok: false, message: 'Enter the email you signed up with.' });
  });

  it('sets a new password only if it is a good one', async () => {
    const { client, calls } = fake();
    const service = createAuthService(client, web);
    assert.equal((await service.setNewPassword('short')).ok, false);
    assert.equal(calls.update, undefined);
    assert.deepEqual(await service.setNewPassword('Sunday2026'), { ok: true, status: 'done' });
    assert.deepEqual(calls.update[0], { password: 'Sunday2026' });
  });

  it('saves a name and relationship as preferences', async () => {
    const { client, calls } = fake();
    await createAuthService(client, web).saveProfile({ firstName: ' Sam ', lastName: 'Lee', relationship: 'coach' });
    assert.deepEqual(calls.update[0], { data: { first_name: 'Sam', last_name: 'Lee', display_name: 'Sam Lee', relationship: 'coach' } });
  });

  it('signs out even if the server cannot be reached', async () => {
    const { client } = fake({ signOut: async () => { throw new Error('offline'); } });
    assert.deepEqual(await createAuthService(client, web).signOut(), { ok: true, status: 'done' });
  });

  it('says accounts are off when there is no project', async () => {
    const service = createAuthService(null, web);
    for (const result of [await service.signIn({ email: 'a@b.co', password: 'x' }), await service.google(), await service.signOut(), await service.forgotPassword('a@b.co')]) {
      assert.deepEqual(result, { ok: false, message: 'Accounts aren’t switched on in this version of the app.' });
    }
  });
});
