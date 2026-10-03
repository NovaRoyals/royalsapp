// @ts-nocheck — written for Deno (Supabase Edge Functions), which the app's TypeScript does not know.
// The decisions it relies on are in ../_shared/polish.ts, which is type-checked and unit-tested.
/**
 * Edge Function `coach-polish`: tidies a coach's session recap with a language model.
 *
 *   app (signed-in coach) → this function → OpenRouter (DeepSeek V4 Flash) → text back to the coach
 *
 * It never sends anything to families. The coach reviews the text and approves the send separately.
 *
 * Secrets (Dashboard → Edge Functions → Secrets; never in git, never in the app):
 *   OPENROUTER_API_KEY
 *
 * All the decisions live in ../_shared/polish.ts (and are unit-tested); this file only connects
 * the real services. Every database call runs as the signed-in coach, so the database's own rules
 * (is this person a coach of this team, how many polishes this hour) are what protect it. No
 * service-role key is used.
 *
 * `verify_jwt` is off in config.toml because projects on the new API keys sign users in with keys
 * the gateway check does not know; this function verifies the user itself.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

import { handlePolish, openRouterCall, type PolishDeps } from '../_shared/polish.ts';

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

  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) return reply(503, { error: 'not_configured' });

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

  // A client that carries the caller's own token: every query runs as them.
  const client = createClient(url, publishable, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });

  const deps: PolishDeps = {
    getUser: async () => {
      const { data, error } = await client.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
      return error || !data.user ? null : { id: data.user.id };
    },
    context: async (teamId) => {
      const { data, error } = await client.rpc('polish_context', { p_team: teamId });
      if (error) throw { code: error.code };
      const names = Array.isArray(data?.names) ? (data.names as unknown[]).filter((n): n is string => typeof n === 'string') : [];
      return { names, remaining: Number(data?.remaining ?? 0) };
    },
    log: async ({ teamId, recapId, original, generated, mode }) => {
      const { error } = await client.rpc('log_polish', {
        p_team: teamId,
        p_recap: recapId,
        p_original: original,
        p_generated: generated,
        p_mode: mode,
      });
      if (error) throw error;
    },
    model: openRouterCall(apiKey, (input, init) => fetch(input, init)),
  };

  const result = await handlePolish(body, deps);
  return reply(result.status, result.body);
});
