/**
 * The logic of the `create-checkout` and `stripe-webhook` Edge Functions, free of Deno- and
 * Supabase-specific code so it runs (and is tested) in plain Node. The `index.ts` files only wire
 * real services in.
 *
 * Promises this file keeps:
 *   - the app never sends an amount; the database says what is owed (`checkout_context`);
 *   - a live Stripe key is refused unless someone deliberately allows it, so a test build can
 *     never take real money by accident;
 *   - an event is believed only if Stripe's signature on the exact bytes received checks out;
 *   - a registration becomes paid only inside the database's `apply_stripe_event`.
 */

// ------------------------------------------------------------------------------------------
// Test keys only, unless deliberately allowed
// ------------------------------------------------------------------------------------------

/** Returns an error sentence if this key must not be used, otherwise null. */
export function keyProblem(secretKey: string | undefined, allowLive: boolean): string | null {
  if (!secretKey) return 'no Stripe key is set';
  if (/^(sk|rk)_test_/.test(secretKey)) return null;
  if (/^(sk|rk)_live_/.test(secretKey)) return allowLive ? null : 'a live Stripe key is set, but live payments are not switched on';
  return 'the Stripe key does not look like a Stripe key';
}

// ------------------------------------------------------------------------------------------
// Checking that an event really came from Stripe
// ------------------------------------------------------------------------------------------

const encoder = new TextEncoder();
const toHex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

/** Compares without stopping at the first difference. */
function sameText(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Stripe signs `<timestamp>.<raw body>` with the endpoint's secret. The body must be the exact
 * bytes received (as text), not a re-serialised copy. Events older than the tolerance are refused
 * so a captured one cannot be replayed later.
 */
export async function verifyStripeSignature(rawBody: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300) {
  if (!header || !secret) return false;
  const parts = header.split(',').map((piece) => piece.trim().split('='));
  const timestamp = parts.find(([k]) => k === 't')?.[1];
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v).filter(Boolean);
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > toleranceSeconds) return false;
  const expected = await hmacHex(secret, `${timestamp}.${rawBody}`);
  return signatures.some((candidate) => sameText(candidate, expected));
}

// ------------------------------------------------------------------------------------------
// Asking Stripe for a hosted checkout page
// ------------------------------------------------------------------------------------------

export type CheckoutContext = { registration_id: string; amount_cents: number; currency: string; title: string; participants: number; email: string | null };

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/** Where Stripe may send a family back to. Anything else is refused, so the link cannot be turned into a redirect to elsewhere. */
export function isAllowedReturn(url: string): boolean {
  return (
    /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}(\/|$)/.test(url) ||
    /^https:\/\/nova-royals\.expo\.app(\/|$)/.test(url) ||
    /^https:\/\/nova-royals--[a-z0-9]+\.expo\.app(\/|$)/.test(url) ||
    /^https:\/\/(www\.|app\.|register\.)?novaroyalsac\.com(\/|$)/.test(url)
  );
}

const withQuery = (url: string, query: string) => `${url}${url.includes('?') ? '&' : '?'}${query}`;

export async function createCheckoutSession(input: {
  secretKey: string;
  fetchImpl: FetchLike;
  context: CheckoutContext;
  returnTo: string;
}): Promise<{ id: string; url: string }> {
  const { context } = input;
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('client_reference_id', context.registration_id);
  if (context.email) form.set('customer_email', context.email);
  form.set('line_items[0][quantity]', '1');
  form.set('line_items[0][price_data][currency]', context.currency);
  form.set('line_items[0][price_data][unit_amount]', String(context.amount_cents));
  form.set('line_items[0][price_data][product_data][name]', context.title.slice(0, 120));
  form.set('line_items[0][price_data][product_data][description]', `${context.participants} ${context.participants === 1 ? 'player' : 'players'} · NOVA Royals Athletic Club`);
  form.set('metadata[registration_id]', context.registration_id);
  form.set('payment_intent_data[metadata][registration_id]', context.registration_id);
  form.set('payment_intent_data[description]', `NOVA Royals registration ${context.registration_id}`);
  form.set('success_url', withQuery(input.returnTo, `payment=success&registration=${context.registration_id}`));
  form.set('cancel_url', withQuery(input.returnTo, `payment=canceled&registration=${context.registration_id}`));

  const response = await input.fetchImpl('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      // The same registration and amount within a day gives back the same page, never a second charge.
      'Idempotency-Key': `checkout-${context.registration_id}-${context.amount_cents}`,
    },
    body: form.toString(),
  });
  if (!response.ok) throw new StripeError(response.status);
  const data = (await response.json()) as { id?: string; url?: string };
  if (!data.id || !data.url) throw new StripeError(502);
  return { id: data.id, url: data.url };
}

export class StripeError extends Error {
  status: number;
  constructor(status: number) {
    super(`Stripe answered ${status}`);
    this.status = status;
  }
}

// ------------------------------------------------------------------------------------------
// create-checkout: the request
// ------------------------------------------------------------------------------------------

export type Reply = { status: number; body: Record<string, unknown> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CheckoutDeps = {
  secretKey: string | undefined;
  allowLive: boolean;
  getUser: () => Promise<{ id: string } | null>;
  /** `public.checkout_context` as the caller. Throws `{ code }` like a Postgres error. */
  context: (registrationId: string) => Promise<CheckoutContext>;
  fetchImpl: FetchLike;
};

export async function handleCheckout(request: { registrationId?: unknown; returnTo?: unknown }, deps: CheckoutDeps): Promise<Reply> {
  const problem = keyProblem(deps.secretKey, deps.allowLive);
  if (problem) return { status: 503, body: { error: 'not_configured' } };
  const user = await deps.getUser();
  if (!user) return { status: 401, body: { error: 'sign_in' } };

  if (typeof request.registrationId !== 'string' || !UUID.test(request.registrationId)) return { status: 400, body: { error: 'bad_registration' } };
  if (typeof request.returnTo !== 'string' || !isAllowedReturn(request.returnTo)) return { status: 400, body: { error: 'bad_return' } };

  let context: CheckoutContext;
  try {
    context = await deps.context(request.registrationId);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === '42501') return { status: 404, body: { error: 'not_found' } };
    if (code === '28000') return { status: 401, body: { error: 'sign_in' } };
    if (code === 'PY001') return { status: 409, body: { error: 'not_approved' } };
    if (code === 'PY002') return { status: 409, body: { error: 'nothing_to_pay' } };
    return { status: 502, body: { error: 'context_failed' } };
  }

  try {
    const session = await createCheckoutSession({ secretKey: deps.secretKey!, fetchImpl: deps.fetchImpl, context, returnTo: request.returnTo });
    return { status: 200, body: { url: session.url } };
  } catch {
    return { status: 502, body: { error: 'stripe_unavailable' } };
  }
}

// ------------------------------------------------------------------------------------------
// stripe-webhook: what Stripe tells us
// ------------------------------------------------------------------------------------------

/** The only event types the database acts on. Everything else is acknowledged and dropped, not stored. */
export const HANDLED_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'charge.refunded',
];

export type WebhookDeps = {
  secret: string | undefined;
  nowSeconds?: number;
  /** `public.apply_stripe_event` as the service role. */
  apply: (event: Record<string, unknown>) => Promise<{ result?: string }>;
};

export async function handleWebhook(rawBody: string, signature: string | null, deps: WebhookDeps): Promise<Reply> {
  if (!deps.secret) return { status: 503, body: { error: 'not_configured' } };
  if (!(await verifyStripeSignature(rawBody, signature, deps.secret, deps.nowSeconds))) return { status: 400, body: { error: 'bad_signature' } };

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: 'bad_json' } };
  }
  if (typeof event.id !== 'string' || typeof event.type !== 'string') return { status: 400, body: { error: 'not_an_event' } };
  if (!HANDLED_EVENTS.includes(event.type)) return { status: 200, body: { received: true, result: 'ignored' } };

  try {
    const outcome = await deps.apply(event);
    return { status: 200, body: { received: true, result: outcome.result ?? 'ok' } };
  } catch {
    // Stripe retries a non-2xx answer for days, which is what we want if the database was unreachable.
    return { status: 500, body: { error: 'could_not_record' } };
  }
}
