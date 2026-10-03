import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PolishError, createEdgePolish, polishMessage } from '../src/lib/ai/edgePolish.ts';

const request = { original: 'we did passing', mode: 'warm' as const, sessionLabel: 'Ages 7–8', teamId: 'team-uuid', recapId: 'recap-uuid' };

describe('the app’s side of polish', () => {
  it('sends only what the function needs and returns the text', async () => {
    let sent: Record<string, unknown> = {};
    const edge = createEdgePolish(async (body) => {
      sent = body;
      return { status: 200, data: { text: 'We worked on passing.', provider: 'deepseek/deepseek-v4-flash', rejectedClaims: [] } };
    });
    const result = await edge.polish(request);
    assert.deepEqual(sent, { teamId: 'team-uuid', recapId: 'recap-uuid', original: 'we did passing', mode: 'warm', sessionLabel: 'Ages 7–8' });
    assert.deepEqual(result, { text: 'We worked on passing.', provider: 'openrouter', rejectedClaims: [] });
  });

  it('says the right thing for each failure, always that the text is unchanged or why', async () => {
    for (const status of [401, 403, 413, 422, 429, 503, 500, 0]) {
      const edge = createEdgePolish(async () => ({ status, data: null }));
      await assert.rejects(edge.polish(request), (error: PolishError) => {
        assert.ok(error instanceof PolishError);
        assert.equal(error.status, status);
        assert.equal(error.message, polishMessage(status));
        return true;
      });
    }
    assert.match(polishMessage(422), /nothing was changed/);
    assert.match(polishMessage(429), /unchanged/);
    assert.match(polishMessage(500), /unchanged/);
  });

  it('treats a network failure or an empty answer as a plain failure', async () => {
    const down = createEdgePolish(async () => {
      throw new Error('offline');
    });
    await assert.rejects(down.polish(request), (error: PolishError) => error instanceof PolishError && /unchanged/.test(error.message));
    const empty = createEdgePolish(async () => ({ status: 200, data: { text: '   ' } }));
    await assert.rejects(empty.polish(request), PolishError);
    const nothing = createEdgePolish(async () => ({ status: 200, data: null }));
    await assert.rejects(nothing.polish(request), PolishError);
  });
});
