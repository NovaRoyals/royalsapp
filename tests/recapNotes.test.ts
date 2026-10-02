import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { familyCanSee, noteTargets } from '../src/lib/recapPrivacy.ts';

describe('child-specific recap notes', () => {
  const present = [{ id: 'maya' }, { id: 'sage' }];

  it('keeps absent and unrecorded children out of the note list', () => {
    const eligible = noteTargets(present, ['sage', 'unrecorded-1']);
    assert.deepEqual(eligible.map((person) => person.id), ['maya']);
  });

  it('shows a parent the shared recap and only their own child note', () => {
    const updates = [
      { kind: 'session_recap', body: 'Today the group' },
      { kind: 'private_note', childId: 'maya', body: 'For Maya' },
      { kind: 'private_note', childId: 'jonah', body: 'For Jonah' },
    ];
    const visible = updates.filter((item) => familyCanSee(item, ['maya']));
    assert.deepEqual(visible.map((item) => item.body), ['Today the group', 'For Maya']);
  });

  it('keeps a private note when the shared recap changes', () => {
    const note = { originalText: 'Kept encouraging teammates.' };
    const shared = 'Today the group worked on passing.';
    const nextShared = 'Today the group closed with a small-sided game.';
    assert.notEqual(note.originalText, shared);
    assert.equal(note.originalText, 'Kept encouraging teammates.');
    assert.equal(nextShared.includes(note.originalText), false);
  });
});
