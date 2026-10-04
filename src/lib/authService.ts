import type { Session, User } from '@supabase/supabase-js';

import { authMessage, isEmail, parseAuthCallback, passwordProblem, type AuthErrorLike } from './authMessages';

/**
 * Sign-in as the app uses it: email and password, Google, and the emails that come with them.
 * The database client is passed in, so each behaviour here is tested without a network.
 *
 * What a person says about themselves at sign-up (name, how they relate to the club) is kept as
 * plain preferences. It never decides what they are allowed to do; the database does that.
 */

export type Relationship = 'parent' | 'player' | 'supporter' | 'coach' | 'manager';
const RELATIONSHIPS: Relationship[] = ['parent', 'player', 'supporter', 'coach', 'manager'];

export type AccountUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  relationship: Relationship | null;
};

export type AuthOutcome =
  | { ok: true; status: 'signed-in'; user: AccountUser; recovery?: boolean }
  | { ok: true; status: 'confirm-email'; email: string }
  | { ok: true; status: 'redirecting' }
  | { ok: true; status: 'sent' | 'done' }
  | { ok: false; message: string };

type AuthResponse = { data: { user?: User | null; session?: Session | null; url?: string | null }; error: AuthErrorLike };

/** The few things of the database client this file uses. */
export type AuthClient = {
  auth: {
    signUp(args: { email: string; password: string; options?: Record<string, unknown> }): Promise<AuthResponse>;
    signInWithPassword(args: { email: string; password: string }): Promise<AuthResponse>;
    signInWithOAuth(args: { provider: 'google'; options?: Record<string, unknown> }): Promise<AuthResponse>;
    setSession(args: { access_token: string; refresh_token: string }): Promise<AuthResponse>;
    exchangeCodeForSession(code: string): Promise<AuthResponse>;
    resetPasswordForEmail(email: string, options?: { redirectTo?: string }): Promise<{ error: AuthErrorLike }>;
    resend(args: { type: 'signup'; email: string; options?: { emailRedirectTo?: string } }): Promise<{ error: AuthErrorLike }>;
    updateUser(args: { password?: string; data?: Record<string, unknown> }): Promise<AuthResponse>;
    signOut(): Promise<{ error: AuthErrorLike }>;
  };
};

export type AuthEnv = {
  isWeb: boolean;
  /** Where email links and the Google sign-in come back to. */
  redirectUrl: () => string;
  /** Whether Google sign-in is switched on for the project: true, false, or null when that cannot be told. */
  googleEnabled?: () => Promise<boolean | null>;
  /** Native only: open the browser for Google and wait for it to return. */
  openBrowser?: (url: string, returnTo: string) => Promise<{ type: string; url?: string }>;
};

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** A person's name and preferences out of what the sign-in method supplied. */
export function summarizeUser(user: Pick<User, 'id' | 'email' | 'user_metadata'>): AccountUser {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const full = clean(meta.full_name) || clean(meta.name);
  let firstName = clean(meta.first_name) || clean(meta.given_name);
  let lastName = clean(meta.last_name) || clean(meta.family_name);
  if (!firstName && full) {
    const [first, ...rest] = full.split(/\s+/);
    firstName = first;
    lastName = lastName || rest.join(' ');
  }
  const relationship = RELATIONSHIPS.find((item) => item === meta.relationship) ?? null;
  return { id: user.id, email: user.email ?? '', firstName, lastName, relationship };
}

const UNAVAILABLE: AuthOutcome = { ok: false, message: 'Accounts aren’t switched on in this version of the app.' };
const fail = (error: AuthErrorLike): AuthOutcome => ({ ok: false, message: authMessage(error) });

export function createAuthService(client: AuthClient | null, env: AuthEnv) {
  const signedIn = (user: User | null | undefined, extra: { recovery?: boolean } = {}): AuthOutcome =>
    user ? { ok: true, status: 'signed-in', user: summarizeUser(user), ...extra } : { ok: false, message: authMessage(null) };

  /** Finish a sign-in, a confirmation or a password reset from the address the person came back to. */
  const applyCallback = async (url: string): Promise<AuthOutcome> => {
    if (!client) return UNAVAILABLE;
    const parsed = parseAuthCallback(url);
    try {
      if (parsed.kind === 'error') return { ok: false, message: parsed.message };
      if (parsed.kind === 'session') {
        const { data, error } = await client.auth.setSession({ access_token: parsed.accessToken, refresh_token: parsed.refreshToken });
        if (error) return fail(error);
        return signedIn(data.user, { recovery: parsed.type === 'recovery' });
      }
      if (parsed.kind === 'code') {
        const { data, error } = await client.auth.exchangeCodeForSession(parsed.code);
        if (error) return fail(error);
        return signedIn(data.user);
      }
      return { ok: false, message: 'That link didn’t work. Try signing in again.' };
    } catch (error) {
      return fail(error as AuthErrorLike);
    }
  };

  return {
    applyCallback,
    async signUp(input: { email: string; password: string; firstName: string; lastName?: string; relationship?: Relationship | null }): Promise<AuthOutcome> {
      if (!client) return UNAVAILABLE;
      const email = input.email.trim().toLowerCase();
      if (!isEmail(email)) return { ok: false, message: 'Enter a valid email address.' };
      const problem = passwordProblem(input.password);
      if (problem) return { ok: false, message: problem };
      const firstName = input.firstName.trim();
      const lastName = (input.lastName ?? '').trim();
      try {
        const { data, error } = await client.auth.signUp({
          email,
          password: input.password,
          options: {
            emailRedirectTo: env.redirectUrl(),
            data: {
              first_name: firstName,
              last_name: lastName,
              display_name: [firstName, lastName].filter(Boolean).join(' '),
              ...(input.relationship ? { relationship: input.relationship } : {}),
            },
          },
        });
        if (error) return fail(error);
        // With email confirmation on, signing up with an address that already has an account
        // "succeeds" without a session and with no identities, so that nobody can probe who has one.
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          return fail({ code: 'user_already_exists' });
        }
        if (data.session) return signedIn(data.user);
        return { ok: true, status: 'confirm-email', email };
      } catch (error) {
        return fail(error as AuthErrorLike);
      }
    },

    async signIn(input: { email: string; password: string }): Promise<AuthOutcome> {
      if (!client) return UNAVAILABLE;
      const email = input.email.trim().toLowerCase();
      if (!isEmail(email)) return { ok: false, message: 'Enter a valid email address.' };
      if (!input.password) return { ok: false, message: 'Enter your password.' };
      try {
        const { data, error } = await client.auth.signInWithPassword({ email, password: input.password });
        if (error) return fail(error);
        return signedIn(data.user);
      } catch (error) {
        return fail(error as AuthErrorLike);
      }
    },

    async google(): Promise<AuthOutcome> {
      if (!client) return UNAVAILABLE;
      const returnTo = env.redirectUrl();
      try {
        // Ask first, so a project without Google gets a plain sentence and not a raw error page.
        const enabled = env.googleEnabled ? await env.googleEnabled().catch(() => null) : null;
        if (enabled === false) return fail({ code: 'provider_disabled' });
        const { data, error } = await client.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: returnTo, skipBrowserRedirect: !env.isWeb, queryParams: { prompt: 'select_account' } },
        });
        if (error) return fail(error);
        // On the web the page itself moves to Google and comes back to the callback screen.
        if (env.isWeb) return { ok: true, status: 'redirecting' };
        if (!data.url || !env.openBrowser) return { ok: false, message: authMessage(null) };
        const result = await env.openBrowser(data.url, returnTo);
        if (result.type !== 'success' || !result.url) return { ok: false, message: 'Google sign-in was cancelled.' };
        return await applyCallback(result.url);
      } catch (error) {
        return fail(error as AuthErrorLike);
      }
    },

    async resendConfirmation(emailInput: string): Promise<AuthOutcome> {
      if (!client) return UNAVAILABLE;
      const email = emailInput.trim().toLowerCase();
      if (!isEmail(email)) return { ok: false, message: 'Enter a valid email address.' };
      try {
        const { error } = await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: env.redirectUrl() } });
        return error ? fail(error) : { ok: true, status: 'sent' };
      } catch (error) {
        return fail(error as AuthErrorLike);
      }
    },

    /** Always the same answer for any address, so the screen cannot be used to find who has an account. */
    async forgotPassword(emailInput: string): Promise<AuthOutcome> {
      if (!client) return UNAVAILABLE;
      const email = emailInput.trim().toLowerCase();
      if (!isEmail(email)) return { ok: false, message: 'Enter the email you signed up with.' };
      try {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: env.redirectUrl() });
        if (error && (error.status === 429 || /rate limit/i.test(error.message ?? ''))) return fail(error);
        return { ok: true, status: 'sent' };
      } catch (error) {
        return fail(error as AuthErrorLike);
      }
    },

    async setNewPassword(password: string): Promise<AuthOutcome> {
      if (!client) return UNAVAILABLE;
      const problem = passwordProblem(password);
      if (problem) return { ok: false, message: problem };
      try {
        const { error } = await client.auth.updateUser({ password });
        return error ? fail(error) : { ok: true, status: 'done' };
      } catch (error) {
        return fail(error as AuthErrorLike);
      }
    },

    /** Name and how they relate to the club, after a sign-in method that did not ask for them. */
    async saveProfile(input: { firstName: string; lastName?: string; relationship?: Relationship | null }): Promise<AuthOutcome> {
      if (!client) return UNAVAILABLE;
      const firstName = input.firstName.trim();
      const lastName = (input.lastName ?? '').trim();
      try {
        const { data, error } = await client.auth.updateUser({
          data: {
            first_name: firstName,
            last_name: lastName,
            display_name: [firstName, lastName].filter(Boolean).join(' '),
            ...(input.relationship ? { relationship: input.relationship } : {}),
          },
        });
        return error ? fail(error) : signedIn(data.user);
      } catch (error) {
        return fail(error as AuthErrorLike);
      }
    },

    async signOut(): Promise<AuthOutcome> {
      if (!client) return UNAVAILABLE;
      try {
        await client.auth.signOut();
      } catch {
        // The device's own session is cleared either way.
      }
      return { ok: true, status: 'done' };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
