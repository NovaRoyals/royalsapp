/**
 * Coach recap polish — client talks to this interface only.
 *
 * Production path (not wired in this slice):
 *   Expo app → authenticated Supabase Edge Function `coach-polish` → OpenRouter
 *
 * TODO(server): store the OpenRouter key as a Supabase Edge Function secret
 * (`OPENROUTER_API_KEY`). Never put it in Expo env, git, or this client.
 *
 * The Edge Function must:
 * - verify the caller is an assigned coach for the session (RLS + membership)
 * - accept only original recap text, polish mode, and session label
 * - replace child names with {player} before the model sees them
 * - request structured JSON { text, rejectedClaims[] }
 * - reject invented claims (new drills, injuries, scores, named kids)
 * - rate-limit per coach
 * - log original, generated, and later coach-approved versions
 * - never send to families; send is a separate coach-approved action
 */
export type RecapPolishMode = 'cleanup' | 'warm' | 'verbatim';

export type PolishRequest = {
  original: string;
  mode: RecapPolishMode;
  sessionLabel: string;
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

export function getCoachPolishProvider(): CoachPolishProvider {
  return mockCoachPolish;
}
