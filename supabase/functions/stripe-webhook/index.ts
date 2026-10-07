// @ts-nocheck — written for Deno (Supabase Edge Functions), which the app's TypeScript does not know.
// The decisions it relies on are in ../_shared/stripe.ts, which is type-checked and unit-tested.
/**
 * Edge Function `stripe-webhook`: Stripe tells us a payment happened, failed, expired or was refunded.
 *
 * It believes nothing it cannot verify. The signature on the exact bytes received is checked
 * against the endpoint's signing secret first; only then is the event handed to the database's
 * `apply_stripe_event`, which decides what it means (and is the only place a registration becomes
 * paid). The service-role key is used for that one call and nothing else.
 *
 * Secrets (Dashboard -> Edge Functions -> Secrets; never in git, never in the app):
 *   STRIPE_WEBHOOK_SECRET   the endpoint's signing secret (whsec_...), shown once by Stripe.
 *
 * `verify_jwt` is off in config.toml: Stripe is not a signed-in user. The signature is the lock.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

import { handleWebhook } from '../_shared/stripe.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('post only', { status: 405 });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return new Response(JSON.stringify({ error: 'not_configured' }), { status: 503 });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // The raw text, exactly as received: the signature covers these bytes.
  const rawBody = await req.text();

  const result = await handleWebhook(rawBody, req.headers.get('stripe-signature'), {
    secret: Deno.env.get('STRIPE_WEBHOOK_SECRET'),
    apply: async (event) => {
      const { data, error } = await admin.rpc('apply_stripe_event', { p_event: event });
      if (error) throw error;
      return data;
    },
  });
  return new Response(JSON.stringify(result.body), { status: result.status, headers: { 'Content-Type': 'application/json' } });
});
