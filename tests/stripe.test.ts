import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  HANDLED_EVENTS,
  StripeError,
  createCheckoutSession,
  handleCheckout,
  handleWebhook,
  isAllowedReturn,
  keyProblem,
  verifyStripeSignature,
  type CheckoutContext,
  type CheckoutDeps,
} from '../supabase/functions/_shared/stripe.ts';

const SECRET = 'whsec_test_secret';
const REG = '11111111-1111-4111-8111-111111111111';
const NOW = 1_800_000_000;

const sign = (body: string, secret = SECRET, t = NOW) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
const event = (type: string, id = 'evt_1') => JSON.stringify({ id, type, data: { object: { id: 'cs_1', client_reference_id: REG } } });

describe('only test keys, unless someone deliberately allows live', () => {
  it('accepts test keys and refuses everything else', () => {
    assert.equal(keyProblem('sk_test_abc', false), null);
    assert.equal(keyProblem('rk_test_abc', false), null);
    assert.match(keyProblem('sk_live_abc', false)!, /live payments are not switched on/);
    assert.equal(keyProblem('sk_live_abc', true), null);
    assert.match(keyProblem('pk_test_abc', false)!, /does not look like/);
    assert.match(keyProblem(undefined, false)!, /no Stripe key/);
    assert.match(keyProblem('', true)!, /no Stripe key/);
  });
});

describe('checking that an event came from Stripe', () => {
  const body = event('checkout.session.completed');

  it('accepts a correctly signed event', async () => {
    assert.equal(await verifyStripeSignature(body, sign(body), SECRET, NOW), true);
  });

  it('refuses a wrong secret, a changed body and a missing or broken header', async () => {
    assert.equal(await verifyStripeSignature(body, sign(body, 'whsec_other'), SECRET, NOW), false);
    assert.equal(await verifyStripeSignature(body.replace('cs_1', 'cs_2'), sign(body), SECRET, NOW), false);
    assert.equal(await verifyStripeSignature(body, null, SECRET, NOW), false);
    assert.equal(await verifyStripeSignature(body, 'garbage', SECRET, NOW), false);
    assert.equal(await verifyStripeSignature(body, `t=${NOW}`, SECRET, NOW), false);
    assert.equal(await verifyStripeSignature(body, `t=abc,v1=00`, SECRET, NOW), false);
    assert.equal(await verifyStripeSignature(body, sign(body), '', NOW), false);
  });

  it('refuses a captured event replayed later, but allows a little clock drift', async () => {
    assert.equal(await verifyStripeSignature(body, sign(body), SECRET, NOW + 301), false);
    assert.equal(await verifyStripeSignature(body, sign(body), SECRET, NOW + 120), true);
    assert.equal(await verifyStripeSignature(body, sign(body), SECRET, NOW - 120), true);
  });

  it('accepts any one good signature among several (Stripe sends two while a secret is being rotated)', async () => {
    const good = createHmac('sha256', SECRET).update(`${NOW}.${body}`).digest('hex');
    assert.equal(await verifyStripeSignature(body, `t=${NOW},v1=${'0'.repeat(64)},v1=${good}`, SECRET, NOW), true);
  });
});

describe('where a family may be sent back to', () => {
  it('allows the club’s own addresses and local testing', () => {
    for (const url of ['http://localhost:8083/registration/return', 'http://127.0.0.1:8084/', 'https://nova-royals.expo.app/x', 'https://nova-royals--hy88s1amhd.expo.app/', 'https://www.novaroyalsac.com/register', 'https://register.novaroyalsac.com']) {
      assert.equal(isAllowedReturn(url), true, url);
    }
  });

  it('refuses anyone else’s address, look-alikes and other schemes', () => {
    for (const url of ['https://evil.example/', 'https://novaroyalsac.com.evil.example/', 'https://nova-royals.expo.app.evil.example/', 'https://evil.example/?https://nova-royals.expo.app/', 'http://novaroyalsac.com/', 'javascript:alert(1)', 'royals://x', '', 'https://nova-royals--x.expo.app@evil.example/']) {
      assert.equal(isAllowedReturn(url), false, url);
    }
  });
});

const CTX: CheckoutContext = { registration_id: REG, amount_cents: 12000, currency: 'usd', title: 'Fall Soccer Training', participants: 2, email: 'jordan@example.com' };

describe('asking Stripe for a payment page', () => {
  it('sends the amount from the database, the registration id, and the key only in the header', async () => {
    let seen: { url: string; headers: Record<string, string>; form: URLSearchParams } | null = null;
    const result = await createCheckoutSession({
      secretKey: 'sk_test_SECRETVALUE',
      context: CTX,
      returnTo: 'https://nova-royals.expo.app/registration/return',
      fetchImpl: async (url, init) => {
        seen = { url, headers: init.headers, form: new URLSearchParams(init.body) };
        return { ok: true, status: 200, json: async () => ({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }) };
      },
    });
    assert.deepEqual(result, { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
    assert.equal(seen!.url, 'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(seen!.headers.Authorization, 'Bearer sk_test_SECRETVALUE');
    assert.equal(seen!.headers['Idempotency-Key'], `checkout-${REG}-12000`);
    const f = seen!.form;
    assert.equal(f.get('mode'), 'payment');
    assert.equal(f.get('client_reference_id'), REG);
    assert.equal(f.get('line_items[0][price_data][unit_amount]'), '12000');
    assert.equal(f.get('line_items[0][price_data][currency]'), 'usd');
    assert.equal(f.get('line_items[0][quantity]'), '1');
    assert.equal(f.get('customer_email'), 'jordan@example.com');
    assert.equal(f.get('metadata[registration_id]'), REG);
    assert.match(f.get('line_items[0][price_data][product_data][description]')!, /2 players/);
    assert.equal(f.get('success_url'), `https://nova-royals.expo.app/registration/return?payment=success&registration=${REG}`);
    assert.equal(f.get('cancel_url'), `https://nova-royals.expo.app/registration/return?payment=canceled&registration=${REG}`);
    assert.ok(!seen!.form.toString().includes('SECRETVALUE'), 'the key must never be in the body');
  });

  it('keeps an existing query string intact and omits a missing email', async () => {
    let form: URLSearchParams | null = null;
    await createCheckoutSession({
      secretKey: 'sk_test_x',
      context: { ...CTX, email: null, participants: 1 },
      returnTo: 'http://localhost:8083/return?from=app',
      fetchImpl: async (_url, init) => {
        form = new URLSearchParams(init.body);
        return { ok: true, status: 200, json: async () => ({ id: 'cs', url: 'https://checkout.stripe.com/x' }) };
      },
    });
    assert.equal(form!.get('success_url'), `http://localhost:8083/return?from=app&payment=success&registration=${REG}`);
    assert.equal(form!.has('customer_email'), false);
    assert.match(form!.get('line_items[0][price_data][product_data][description]')!, /1 player ·/);
  });

  it('reports a Stripe failure as one', async () => {
    await assert.rejects(
      createCheckoutSession({ secretKey: 'sk_test_x', context: CTX, returnTo: 'http://localhost:8083/', fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) }) }),
      (error: StripeError) => error instanceof StripeError && error.status === 401,
    );
    await assert.rejects(createCheckoutSession({ secretKey: 'sk_test_x', context: CTX, returnTo: 'http://localhost:8083/', fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }) }), StripeError);
  });
});

function checkoutDeps(patch: Partial<CheckoutDeps> = {}) {
  const calls = { context: 0, stripe: 0 };
  const deps: CheckoutDeps = {
    secretKey: 'sk_test_x',
    allowLive: false,
    getUser: async () => ({ id: 'parent-1' }),
    context: async () => {
      calls.context += 1;
      return CTX;
    },
    fetchImpl: async () => {
      calls.stripe += 1;
      return { ok: true, status: 200, json: async () => ({ id: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1' }) };
    },
    ...patch,
  };
  return { deps, calls };
}
const ask = (patch: Record<string, unknown> = {}) => ({ registrationId: REG, returnTo: 'http://localhost:8083/return', ...patch });

describe('the create-checkout request', () => {
  it('returns the payment page address for a good request', async () => {
    const { deps } = checkoutDeps();
    assert.deepEqual(await handleCheckout(ask(), deps), { status: 200, body: { url: 'https://checkout.stripe.com/c/pay/cs_1' } });
  });

  it('does nothing when the key is missing or live without permission', async () => {
    for (const secretKey of [undefined, 'sk_live_x', 'nonsense']) {
      const { deps, calls } = checkoutDeps({ secretKey });
      assert.equal((await handleCheckout(ask(), deps)).status, 503);
      assert.equal(calls.context + calls.stripe, 0);
    }
    const live = checkoutDeps({ secretKey: 'sk_live_x', allowLive: true });
    assert.equal((await handleCheckout(ask(), live.deps)).status, 200);
  });

  it('turns away someone who is not signed in, and malformed requests, before anything else', async () => {
    const out = checkoutDeps({ getUser: async () => null });
    assert.equal((await handleCheckout(ask(), out.deps)).status, 401);
    const { deps, calls } = checkoutDeps();
    assert.equal((await handleCheckout(ask({ registrationId: 'x' }), deps)).status, 400);
    assert.equal((await handleCheckout(ask({ returnTo: 'https://evil.example/' }), deps)).status, 400);
    assert.equal((await handleCheckout(ask({ returnTo: undefined }), deps)).status, 400);
    assert.equal(calls.context + calls.stripe, 0);
  });

  it('maps each answer of the database and never calls Stripe after a refusal', async () => {
    const cases: [string, number, string][] = [['42501', 404, 'not_found'], ['28000', 401, 'sign_in'], ['PY001', 409, 'not_approved'], ['PY002', 409, 'nothing_to_pay'], ['XX000', 502, 'context_failed']];
    for (const [code, status, error] of cases) {
      const { deps, calls } = checkoutDeps({ context: async () => { throw { code }; } });
      const reply = await handleCheckout(ask(), deps);
      assert.deepEqual([reply.status, reply.body.error], [status, error]);
      assert.equal(calls.stripe, 0);
    }
  });

  it('says so, without detail, when Stripe is unavailable', async () => {
    const { deps } = checkoutDeps({ fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }) });
    assert.deepEqual(await handleCheckout(ask(), deps), { status: 502, body: { error: 'stripe_unavailable' } });
  });
});

describe('the stripe-webhook request', () => {
  const applied: Record<string, unknown>[] = [];
  const deps = (patch: Record<string, unknown> = {}) => {
    applied.length = 0;
    return {
      secret: SECRET,
      nowSeconds: NOW,
      apply: async (e: Record<string, unknown>) => {
        applied.push(e);
        return { result: 'paid' };
      },
      ...patch,
    };
  };

  it('records a correctly signed payment event', async () => {
    const body = event('checkout.session.completed');
    const reply = await handleWebhook(body, sign(body), deps());
    assert.deepEqual(reply, { status: 200, body: { received: true, result: 'paid' } });
    assert.equal(applied.length, 1);
    assert.equal(applied[0].id, 'evt_1');
  });

  it('records nothing for a forged, altered or stale event', async () => {
    const body = event('checkout.session.completed');
    for (const header of [sign(body, 'whsec_attacker'), sign(body.replace('evt_1', 'evt_2')), sign(body, SECRET, NOW - 4000), null, '']) {
      const d = deps();
      const reply = await handleWebhook(body, header, d);
      assert.equal(reply.status, 400);
      assert.equal(applied.length, 0);
    }
  });

  it('says it is not configured, rather than guessing, when there is no signing secret', async () => {
    const body = event('checkout.session.completed');
    const reply = await handleWebhook(body, sign(body, ''), deps({ secret: undefined }));
    assert.equal(reply.status, 503);
    assert.equal(applied.length, 0);
  });

  it('acknowledges but does not store event types the database does not act on', async () => {
    const body = event('customer.created', 'evt_x');
    const reply = await handleWebhook(body, sign(body), deps());
    assert.deepEqual(reply, { status: 200, body: { received: true, result: 'ignored' } });
    assert.equal(applied.length, 0);
    for (const type of HANDLED_EVENTS) {
      const handled = event(type, `evt_${type}`);
      assert.equal((await handleWebhook(handled, sign(handled), deps())).status, 200);
      assert.equal(applied.length, 1);
    }
  });

  it('asks Stripe to retry (a 500) when the database could not record the event', async () => {
    const body = event('checkout.session.completed');
    const reply = await handleWebhook(body, sign(body), deps({ apply: async () => { throw new Error('db down'); } }));
    assert.equal(reply.status, 500);
  });

  it('rejects a signed body that is not an event', async () => {
    for (const body of ['not json', JSON.stringify({ hello: 'world' })]) {
      assert.equal((await handleWebhook(body, sign(body), deps())).status, 400);
    }
  });
});
