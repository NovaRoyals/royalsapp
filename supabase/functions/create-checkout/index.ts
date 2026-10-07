// @ts-nocheck — written for Deno (Supabase Edge Functions), which the app's TypeScript does not know.
// The decisions it relies on are in ../_shared/stripe.ts, which is type-checked and unit-tested.
/**
 * Edge Function `create-checkout`: a signed-in parent asks to pay for an approved registration and
 * gets back the address of Stripe's hosted payment page.
 *
 *   app (signed-in parent) -> this function -> database (what is owed?) -> Stripe -> page address
 *
 * The app sends only the registration's id and where to come back to. The amount comes from the
 * database. Every database call runs as the parent, so the database's own rules decide whether
 * this is their registration. No service-role key is used here.
 *
 * Secrets (Dashboard -> Edge Functions -> Secrets; never in git, never in the app):
 *   STRIPE_SECRET_KEY    a test key (sk_test_...). A live key is refused unless STRIPE_ALLOW_LIVE=yes.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

import { handleCheckout } from '../_shared/stripe.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'post_only' });

  const url = Deno.env.get('SUPABASE_URL');
  const publishable = req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = req.headers.get('Authorization');
  if (!url || !publishable || !authorization) return reply(401, { error: 'sign_in' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'bad_json' });
  }

  const client = createClient(url, publishable, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });

  const result = await handleCheckout(body, {
    secretKey: Deno.env.get('STRIPE_SECRET_KEY'),
    allowLive: Deno.env.get('STRIPE_ALLOW_LIVE') === 'yes',
    getUser: async () => {
      const { data, error } = await client.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
      return error || !data.user ? null : { id: data.user.id };
    },
    context: async (registrationId) => {
      const { data, error } = await client.rpc('checkout_context', { p_registration: registrationId });
      if (error) throw { code: error.code };
      return data;
    },
    fetchImpl: (input, init) => fetch(input, init),
  });
  return reply(result.status, result.body);
});
