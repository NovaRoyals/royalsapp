import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canSeeThread,
  checkContactInfo,
  checkSend,
  COACH_THREAD,
  initialsOf,
  threadKind,
  threadTime,
  totalUnread,
  unreadCount,
  viewerFor,
  withDayBreaks,
} from '../src/lib/messaging.ts';
import type { DirectMessage } from '../src/types/domain.ts';

const parent = viewerFor('guardian', 'household-demo')!;
const coach = viewerFor('coach', 'household-coach')!;

function message(patch: Partial<DirectMessage>): DirectMessage {
  return {
    id: 'm1',
    threadId: COACH_THREAD,
    fromRole: 'coach',
    fromName: 'Coach Priya Sharma',
    fromId: 'coach:priya',
    body: 'Hello',
    createdAt: '2026-10-02T18:00:00-04:00',
    ...patch,
  };
}

describe('who can see which thread', () => {
  it('lets a family and the coach see the coach thread', () => {
    assert.equal(canSeeThread(parent, COACH_THREAD), true);
    assert.equal(canSeeThread(coach, COACH_THREAD), true);
  });

  it('keeps another family’s thread with the coach away from parents', () => {
    assert.equal(canSeeThread(parent, 'family-u8-lc'), false);
    assert.equal(canSeeThread(coach, 'family-u8-lc'), true);
  });

  it('keeps parent-to-parent threads away from the coach and from admins', () => {
    assert.equal(canSeeThread(parent, 'parent-u8-em'), true);
    assert.equal(canSeeThread(coach, 'parent-u8-em'), false);
    assert.equal(viewerFor('admin', 'x'), null);
    assert.equal(canSeeThread(viewerFor('admin', 'x'), COACH_THREAD), false);
  });

  it('gives guests, players and volunteers no chat at all', () => {
    for (const role of ['guest', 'adult_player', 'volunteer', 'competition_manager'] as const) {
      assert.equal(viewerFor(role, 'x'), null);
    }
  });

  it('names thread kinds from their ids', () => {
    assert.equal(threadKind(COACH_THREAD), 'coach');
    assert.equal(threadKind('family-u8-lc'), 'family');
    assert.equal(threadKind('parent-u8-em'), 'parent');
    assert.equal(threadKind('announcement-3'), null);
  });
});

describe('unread counts', () => {
  const list = [
    message({ id: 'a', fromRole: 'guardian', fromId: 'guardian:household-demo', createdAt: '2026-10-01T09:00:00-04:00' }),
    message({ id: 'b', createdAt: '2026-10-02T18:00:00-04:00' }),
    message({ id: 'c', createdAt: '2026-10-02T19:00:00-04:00' }),
  ];

  it('counts only what others sent since you last looked', () => {
    assert.equal(unreadCount(list, COACH_THREAD, parent, {}), 2);
    assert.equal(unreadCount(list, COACH_THREAD, parent, { [`${parent.id}|${COACH_THREAD}`]: '2026-10-02T18:30:00-04:00' }), 1);
    assert.equal(unreadCount(list, COACH_THREAD, parent, { [`${parent.id}|${COACH_THREAD}`]: '2026-10-03T00:00:00-04:00' }), 0);
  });

  it('never counts your own messages', () => {
    assert.equal(unreadCount([list[0]], COACH_THREAD, parent, {}), 0);
    assert.equal(unreadCount([list[0]], COACH_THREAD, coach, {}), 1);
  });

  it('reads separately for each person', () => {
    const reads = { [`${parent.id}|${COACH_THREAD}`]: '2026-10-03T00:00:00-04:00' };
    assert.equal(unreadCount(list, COACH_THREAD, parent, reads), 0);
    assert.equal(unreadCount(list, COACH_THREAD, coach, reads), 1);
  });

  it('ignores threads you cannot see, blocked threads and parent chat that is off', () => {
    const hidden = [message({ id: 'x', threadId: 'family-u8-lc', fromRole: 'guardian', fromId: 'guardian:family-u8-lc' })];
    assert.equal(totalUnread(hidden, parent, {}), 0);
    assert.equal(totalUnread(hidden, coach, {}), 1);
    const parentMsg = [message({ id: 'p', threadId: 'parent-u8-em', fromRole: 'guardian', fromId: 'guardian:family-u8-em' })];
    assert.equal(totalUnread(parentMsg, parent, {}, [], true), 1);
    assert.equal(totalUnread(parentMsg, parent, {}, [], false), 0);
    assert.equal(totalUnread(parentMsg, parent, {}, ['parent-u8-em'], true), 0);
  });
});

describe('what parents may send each other', () => {
  it('stops phone numbers, emails and links', () => {
    assert.equal(checkContactInfo('call me on 571 555 0148').blocked, true);
    assert.equal(checkContactInfo('my number is (571) 555-0148').blocked, true);
    assert.equal(checkContactInfo('+1 571-555-0148').blocked, true);
    assert.equal(checkContactInfo('email jordan@example.com').blocked, true);
    assert.equal(checkContactInfo('see https://example.com/x').blocked, true);
    assert.equal(checkContactInfo('www.example.com').blocked, true);
  });

  it('lets ordinary team talk through', () => {
    for (const text of ['Carpool Sunday? We pass Arrowhead at 8:30.', 'Field 3A, ages 7-8, 9:00 AM', 'Match is on 2026-10-04', 'Bring 2 bottles and shin guards']) {
      assert.equal(checkContactInfo(text).blocked, false, text);
    }
  });

  it('applies the contact rule to parent threads only', () => {
    const base = { viewer: parent, parentChatOn: true, blocked: [] as string[] };
    assert.equal(checkSend({ ...base, threadId: 'parent-u8-em', body: 'text me 571 555 0148' }).ok, false);
    assert.equal(checkSend({ ...base, threadId: COACH_THREAD, body: 'My number is 571 555 0148 if easier' }).ok, true);
  });

  it('needs parent chat switched on, and refuses blocked or foreign threads', () => {
    const base = { viewer: parent, blocked: [] as string[] };
    assert.equal(checkSend({ ...base, parentChatOn: false, threadId: 'parent-u8-em', body: 'hi' }).ok, false);
    assert.equal(checkSend({ ...base, parentChatOn: true, threadId: 'parent-u8-em', body: 'hi', blocked: ['parent-u8-em'] }).ok, false);
    assert.equal(checkSend({ ...base, parentChatOn: true, threadId: 'family-u8-lc', body: 'hi' }).ok, false);
    assert.equal(checkSend({ ...base, parentChatOn: true, threadId: COACH_THREAD, body: '   ' }).ok, false);
    assert.equal(checkSend({ ...base, parentChatOn: false, threadId: COACH_THREAD, body: 'Maya has a cough' }).ok, true);
  });
});

describe('how messages are labelled', () => {
  it('makes initials from a label', () => {
    assert.equal(initialsOf('Coach Priya Sharma'), 'CS');
    assert.equal(initialsOf('Parent of Elena'), 'PE');
  });

  it('shows time today, Yesterday, then a weekday', () => {
    const now = new Date('2026-10-03T15:00:00-04:00');
    assert.match(threadTime('2026-10-03T09:15:00-04:00', now), /9:15/);
    assert.equal(threadTime('2026-10-02T20:00:00-04:00', now), 'Yesterday');
    assert.equal(threadTime('2026-09-30T10:00:00-04:00', now), 'Wed');
  });

  it('adds one date heading per day', () => {
    const rows = withDayBreaks(
      [
        message({ id: 'a', createdAt: '2026-10-02T09:00:00-04:00' }),
        message({ id: 'b', createdAt: '2026-10-02T09:05:00-04:00' }),
        message({ id: 'c', createdAt: '2026-10-03T09:00:00-04:00' }),
      ],
      new Date('2026-10-03T15:00:00-04:00'),
    );
    assert.deepEqual(rows.map((row) => (row.type === 'day' ? row.label : row.message.id)), ['Yesterday', 'a', 'b', 'Today', 'c']);
  });
});
