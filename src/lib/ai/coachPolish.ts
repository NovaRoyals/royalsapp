/**
 * Coach recap polish — the app talks to this interface only.
 *
 * Connected to a Supabase project, polish goes through the authenticated Edge Function
 * `coach-polish` (supabase/functions), which hides names, calls the model through OpenRouter,
 * checks the answer against what the coach wrote, rate-limits, and logs. The OpenRouter key lives
 * only as an Edge Function secret (`OPENROUTER_API_KEY`), never in the app or in git.
 *
 * Without a project (demo mode) a deterministic tidier stands in, so the screen still works. It
 * does not call a model.
 */
import { supabase } from '../supabase';
import { createEdgePolish } from './edgePolish';

export type RecapPolishMode = 'cleanup' | 'warm' | 'verbatim';

export type PolishRequest = {
  original: string;
  mode: RecapPolishMode;
  sessionLabel: string;
  /** The team's database id. Needed by the real function, ignored by the demo stand-in. */
  teamId?: string;
  recapId?: string;
};

export type PolishResult = {
  text: string;
  provider: 'mock' | 'openrouter';
  rejectedClaims: string[];
};

export interface CoachPolishProvider {
  polish(request: PolishRequest): Promise<PolishResult>;
}

const CHILD_NAME = /\b(Maya|Aria|Jonah|Samir|Elena|Noah|Lila|Omar|Ivy|Theo|Ruby|Felix|Kai|Mina|Leo|Quinn|Sage)\b/gi;

function stripNames(text: string) {
  return text.replace(CHILD_NAME, '{player}');
}

function restoreSentences(text: string) {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  const withEnd = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  return withEnd.charAt(0).toUpperCase() + withEnd.slice(1);
}

/** Deterministic mock — no network, no invented session facts. */
export const mockCoachPolish: CoachPolishProvider = {
  async polish(request) {
    const source = stripNames(request.original).trim();
    if (!source) {
      return { text: '', provider: 'mock', rejectedClaims: [] };
    }
    if (request.mode === 'verbatim') {
      return { text: request.original.trim(), provider: 'mock', rejectedClaims: [] };
    }
    if (request.mode === 'cleanup') {
      return { text: restoreSentences(source.replace(/\{player\}/g, 'players')), provider: 'mock', rejectedClaims: [] };
    }
    const warm = restoreSentences(source)
      .replace(/^Okay so /i, '')
      .replace(/^Um,? /i, '')
      .replace(/\s+We finished /i, ' We closed ')
      .replace(/Remind families /i, 'Please remember ');
    return { text: restoreSentences(warm.replace(/\{player\}/g, 'the group')), provider: 'mock', rejectedClaims: [] };
  },
};

const edgePolish = createEdgePolish(async (body) => {
  const { data, error } = await supabase!.functions.invoke('coach-polish', { body });
  if (!error) return { status: 200, data };
  // A non-2xx answer arrives as an error carrying the HTTP response; the status says what went wrong.
  const response = (error as { context?: Response }).context;
  return { status: response?.status ?? 0, data: await response?.json().catch(() => null) };
});

export function getCoachPolishProvider(): CoachPolishProvider {
  if (!supabase) return mockCoachPolish;
  return { polish: (request) => edgePolish.polish({ ...request, teamId: request.teamId ?? '' }) };
}
