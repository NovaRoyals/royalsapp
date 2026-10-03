import type { PolishRequest, PolishResult } from './coachPolish';

/** What the coach reads when a polish does not go through. Plain, and always says the text is untouched. */
export class PolishError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'PolishError';
    this.status = status;
  }
}

export type InvokeResult = { status: number; data: unknown };
export type InvokePolish = (body: Record<string, unknown>) => Promise<InvokeResult>;

const WORDING: Record<number, string> = {
  401: 'Sign in again to polish. The text in the editor is unchanged.',
  403: 'Only this team’s coaches can polish a recap. The text in the editor is unchanged.',
  413: 'This recap is too long to polish in one go. Shorten it a little. The text in the editor is unchanged.',
  422: 'The AI added something that wasn’t in your recap, so nothing was changed. Try “Clean up only”.',
  429: 'That’s a lot of polishing for one hour. Try again in a little while. The text in the editor is unchanged.',
  503: 'Polish isn’t switched on yet. The text in the editor is unchanged.',
};
const GENERIC = 'Could not polish right now. The text in the editor is unchanged.';

export function polishMessage(status: number) {
  return WORDING[status] ?? GENERIC;
}

/** The coach-polish function as a provider. The function does the hiding of names and the checks. */
export function createEdgePolish(invoke: InvokePolish) {
  return {
    async polish(request: PolishRequest & { teamId: string; recapId?: string }): Promise<PolishResult> {
      let result: InvokeResult;
      try {
        result = await invoke({
          teamId: request.teamId,
          recapId: request.recapId,
          original: request.original,
          mode: request.mode,
          sessionLabel: request.sessionLabel,
        });
      } catch {
        throw new PolishError(GENERIC, 0);
      }
      if (result.status !== 200) throw new PolishError(polishMessage(result.status), result.status);
      const data = result.data as { text?: unknown; provider?: unknown; rejectedClaims?: unknown } | null;
      if (!data || typeof data.text !== 'string' || !data.text.trim()) throw new PolishError(GENERIC, 200);
      return {
        text: data.text,
        provider: 'openrouter',
        rejectedClaims: Array.isArray(data.rejectedClaims) ? data.rejectedClaims.filter((x): x is string => typeof x === 'string') : [],
      };
    },
  };
}
