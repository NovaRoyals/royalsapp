/**
 * The logic of the `coach-polish` Edge Function, kept free of Deno- and Supabase-specific code so it
 * runs (and is tested) in plain Node. `index.ts` only wires real services into `handlePolish`.
 *
 * The promises this file keeps:
 *   - children's and parents' names are replaced by {player1}, {player2}… before any text leaves;
 *   - the model only rewrites; whatever it returns is checked against what the coach wrote, and is
 *     refused if it invented a number, a name, a contact detail or a placeholder;
 *   - the coach always gets text back to review. Nothing here can send anything to a family.
 */

export type PolishMode = 'cleanup' | 'warm' | 'verbatim';

/** Pinned, dated model ids. The `-latest` aliases can change behaviour and price without notice. */
export const MODEL = 'deepseek/deepseek-v4-flash';
export const FALLBACK_MODEL = 'deepseek/deepseek-v3.2';

export const MAX_INPUT_CHARS = 3000;
export const MAX_OUTPUT_TOKENS = 700;

// ------------------------------------------------------------------------------------------
// Hiding names
// ------------------------------------------------------------------------------------------

export type Masked = { text: string; tokens: Record<string, string> };

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Replace every name with a numbered token. The same name always gets the same token, so the model
 * can keep "who did what" straight, and so the answer can be put back exactly.
 */
export function maskNames(text: string, names: string[]): Masked {
  const usable = [...new Set(names.map((name) => name.trim().toLowerCase()).filter((name) => name.length >= 2))].sort(
    (a, b) => b.length - a.length,
  );
  if (usable.length === 0) return { text, tokens: {} };
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${usable.map(escapeRegex).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  const byName = new Map<string, string>();
  const tokens: Record<string, string> = {};
  const masked = text.replace(pattern, (match) => {
    const key = match.toLowerCase();
    let token = byName.get(key);
    if (!token) {
      token = `{player${byName.size + 1}}`;
      byName.set(key, token);
      tokens[token] = match;
    }
    return token;
  });
  return { text: masked, tokens };
}

/** The club's style: no long dashes inside sentences. A model that writes one anyway gets a comma. */
export const noLongDashes = (text: string) => text.replace(/\s*—\s*/g, ', ').replace(/,\s*,/g, ',');

/** A name typed all in lower case ("maya") is capitalised when it goes back; one typed with capitals is left as written. */
const properCase = (name: string) =>
  name === name.toLowerCase() ? name.replace(/(^|[\s'’-])(\p{L})/gu, (_match, before: string, letter: string) => before + letter.toUpperCase()) : name;

/** Put the names back. Only tokens that were handed out are known; anything else is left for the guard. */
export function unmask(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{player\d+\}/g, (token) => (tokens[token] === undefined ? token : properCase(tokens[token])));
}

// ------------------------------------------------------------------------------------------
// The prompt
// ------------------------------------------------------------------------------------------

const BASE_RULES = [
  'You edit a youth sports coach’s spoken or typed session recap before it is shared with the parents of the children who attended.',
  'Keep the coach’s meaning and voice. Use only facts that are in the text.',
  'Never add drills, scores, results, injuries, names, times, places, promises or advice that are not in the text.',
  'Tokens like {player1} stand for a child’s name. Keep them exactly as written, do not guess who they are, and do not add new ones.',
  'Write plain text: no emojis, no headings, no sign-off, no greeting, and no bullet points unless the coach used them.',
  'Do not address any child or parent by name. Keep the numbers, days and times exactly as written.',
  'Never use dashes to join clauses (no — and no –). Use commas or full stops instead.',
];

const MODE_RULES: Record<Exclude<PolishMode, 'verbatim'>, string> = {
  cleanup:
    'Fix spelling, grammar and punctuation, and remove filler words such as “um”, “uh” and “you know”. Keep every sentence and nearly every word the coach chose.',
  warm:
    'Make it friendly, warm and concise for parents, in the coach’s own voice. You may merge or reorder sentences and drop filler and repetition, but keep every fact.',
};

export function buildMessages(mode: Exclude<PolishMode, 'verbatim'>, maskedText: string, sessionLabel: string) {
  const label = sessionLabel.replace(/[^\p{L}\p{N} ·\-–,.:'’/()]/gu, '').slice(0, 80).trim();
  return [
    { role: 'system', content: [...BASE_RULES, MODE_RULES[mode], 'Reply with JSON only: {"text": "<the edited recap>"}.'].join('\n') },
    { role: 'user', content: `${label ? `Session: ${label}\n` : ''}Recap to edit:\n${maskedText}` },
  ];
}

// ------------------------------------------------------------------------------------------
// Checking what comes back
// ------------------------------------------------------------------------------------------

const digitsOnly = (value: string) => value.replace(/\D/g, '');
const numberTokens = (text: string) => [...text.matchAll(/\d+(?:[.:,\-–/]\d+)*/g)].map((m) => digitsOnly(m[0])).filter(Boolean);
const contactTokens = (text: string) =>
  [...text.matchAll(/[^\s@]+@[^\s@]+\.[^\s@]+|(?:https?:\/\/|www\.)\S+|\+?\d[\d\s().\-]{7,}\d/gi)].map((m) => digitsOnly(m[0]) || m[0].toLowerCase());
const wordsOf = (text: string) => text.toLowerCase().match(/[\p{L}][\p{L}'’]*/gu) ?? [];

/**
 * Anything the model produced that was not in the coach's text. Empty means it is safe to show.
 * The checks are deliberately blunt: a false alarm costs the coach one tap on "keep my words",
 * a missed invention puts something false in front of parents.
 */
export function findInventions(maskedOriginal: string, maskedGenerated: string, mode: Exclude<PolishMode, 'verbatim'>): string[] {
  const problems: string[] = [];
  const generated = maskedGenerated.trim();
  if (!generated) return ['empty answer'];

  const originalNumbers = new Set(numberTokens(maskedOriginal.replace(/\{player\d+\}/g, ' ')));
  for (const n of new Set(numberTokens(generated.replace(/\{player\d+\}/g, ' ')))) {
    if (!originalNumbers.has(n)) problems.push(`number ${n}`);
  }

  const originalContacts = new Set(contactTokens(maskedOriginal));
  for (const c of contactTokens(generated)) if (!originalContacts.has(c)) problems.push('contact detail');

  const handedOut = new Set(maskedOriginal.match(/\{player\d+\}/g) ?? []);
  for (const t of generated.match(/\{player\d+\}/g) ?? []) if (!handedOut.has(t)) problems.push(`name token ${t}`);

  // A capitalised word in the middle of a sentence that the coach never wrote is usually a made-up
  // name, team or place ("Coach", "Eagles"). The first word of a sentence is exempt.
  const known = new Set(wordsOf(maskedOriginal));
  const stripped = generated.replace(/\{player\d+\}/g, 'x');
  for (const sentence of stripped.split(/(?<=[.!?])\s+|\n+/)) {
    const words = sentence.match(/[\p{L}][\p{L}'’]*/gu) ?? [];
    words.forEach((word, index) => {
      if (index === 0 || word.length < 3 || word !== word[0].toUpperCase() + word.slice(1).toLowerCase()) return;
      if (!known.has(word.toLowerCase())) problems.push(`name ${word}`);
    });
  }

  const ratio = generated.length / Math.max(1, maskedOriginal.trim().length);
  if (generated.length > maskedOriginal.length * 1.5 + 120) problems.push('much longer than what was written');
  if (ratio < (mode === 'cleanup' ? 0.6 : 0.35)) problems.push('left out too much');

  return [...new Set(problems)];
}

/** The model should answer {"text": "..."}; tolerate a code fence or bare text from a provider that ignored the schema. */
export function parseModelText(content: string): string {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { text?: unknown };
      return typeof parsed.text === 'string' ? parsed.text.trim() : '';
    } catch {
      return '';
    }
  }
  return trimmed;
}

// ------------------------------------------------------------------------------------------
// Talking to OpenRouter
// ------------------------------------------------------------------------------------------

export type ModelCall = (input: { messages: { role: string; content: string }[] }) => Promise<{ text: string; model: string }>;

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

/**
 * The real call. Two attempts: the strict one, then a plainer one for providers that reject the
 * reasoning switch or the JSON schema. Prompts are only sent to providers that do not keep or
 * train on them (`data_collection: deny`).
 */
export function openRouterCall(apiKey: string, fetchImpl: FetchLike, timeoutMs = 20000): ModelCall {
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'NOVA Royals' };
  const base = { models: [MODEL, FALLBACK_MODEL], temperature: 0.3, max_tokens: MAX_OUTPUT_TOKENS };

  type Attempt = { status: number; text?: string; model?: string };
  const attempt = async (messages: { role: string; content: string }[], strict: boolean): Promise<Attempt> => {
    const body = strict
      ? {
          ...base,
          messages,
          reasoning: { enabled: false },
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'polished_recap',
              strict: true,
              schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
            },
          },
          provider: { data_collection: 'deny', require_parameters: true },
        }
      : { ...base, messages, provider: { data_collection: 'deny' } };
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timer = setTimeout(() => controller?.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller?.signal });
      if (!response.ok) return { status: response.status };
      const data = (await response.json()) as { model?: string; choices?: { message?: { content?: string } }[] };
      return { status: 200, text: data.choices?.[0]?.message?.content ?? '', model: data.model ?? MODEL };
    } finally {
      clearTimeout(timer);
    }
  };

  return async ({ messages }) => {
    let result = await attempt(messages, true);
    if (result.status === 400 || result.status === 404 || result.status === 422) result = await attempt(messages, false);
    if (result.status !== 200 || result.text === undefined) throw new ProviderError(result.status);
    return { text: result.text, model: result.model ?? MODEL };
  };
}

export class ProviderError extends Error {
  status: number;
  constructor(status: number) {
    super(`the model service answered ${status}`);
    this.status = status;
  }
}

// ------------------------------------------------------------------------------------------
// The whole request
// ------------------------------------------------------------------------------------------

export type PolishDeps = {
  /** The signed-in user's id, or null if the token is missing or bad. */
  getUser: () => Promise<{ id: string } | null>;
  /** `public.polish_context` as the caller. Throws `{ code }` like a Postgres error. */
  context: (teamId: string) => Promise<{ names: string[]; remaining: number }>;
  /** `public.log_polish` as the caller. */
  log: (entry: { teamId: string; recapId: string | null; original: string; generated: string; mode: PolishMode }) => Promise<void>;
  model: ModelCall;
};

export type PolishRequest = { teamId?: unknown; recapId?: unknown; original?: unknown; mode?: unknown; sessionLabel?: unknown };
export type PolishResponse = { status: number; body: Record<string, unknown> };

const MODES: PolishMode[] = ['cleanup', 'warm', 'verbatim'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handlePolish(request: PolishRequest, deps: PolishDeps): Promise<PolishResponse> {
  const user = await deps.getUser();
  if (!user) return { status: 401, body: { error: 'sign_in' } };

  const mode = request.mode as PolishMode;
  const original = typeof request.original === 'string' ? request.original.trim() : '';
  if (!MODES.includes(mode)) return { status: 400, body: { error: 'bad_mode' } };
  if (typeof request.teamId !== 'string' || !UUID.test(request.teamId)) return { status: 400, body: { error: 'bad_team' } };
  const recapId = typeof request.recapId === 'string' && UUID.test(request.recapId) ? request.recapId : null;
  if (!original) return { status: 400, body: { error: 'empty' } };
  if (original.length > MAX_INPUT_CHARS) return { status: 413, body: { error: 'too_long', max: MAX_INPUT_CHARS } };

  let names: string[];
  try {
    ({ names } = await deps.context(request.teamId));
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'RL001') return { status: 429, body: { error: 'rate_limited' } };
    if (code === '42501' || code === '28000') return { status: 403, body: { error: 'not_a_coach' } };
    return { status: 502, body: { error: 'context_failed' } };
  }

  // Keeping the words exactly as they are needs no model, no cost and no names leaving.
  if (mode === 'verbatim') return { status: 200, body: { text: original, mode, provider: 'none', rejectedClaims: [] } };

  const masked = maskNames(original, names);
  const label = typeof request.sessionLabel === 'string' ? maskNames(request.sessionLabel, names).text : '';

  let answer: { text: string; model: string };
  try {
    answer = await deps.model({ messages: buildMessages(mode, masked.text, label) });
  } catch {
    return { status: 502, body: { error: 'model_unavailable' } };
  }

  const maskedAnswer = parseModelText(answer.text);
  const problems = findInventions(masked.text, maskedAnswer, mode);
  if (problems.length > 0) return { status: 422, body: { error: 'rejected', rejectedClaims: problems } };

  const text = noLongDashes(unmask(maskedAnswer, masked.tokens)).trim();
  try {
    await deps.log({ teamId: request.teamId, recapId, original, generated: text, mode });
  } catch {
    // The audit row failing must not lose the coach's polished text, but it must be visible.
    return { status: 200, body: { text, mode, provider: answer.model, rejectedClaims: [], logged: false } };
  }
  return { status: 200, body: { text, mode, provider: answer.model, rejectedClaims: [], logged: true } };
}
