import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CLUB_TIME_ZONE, zonedParts } from '../src/lib/datetime.ts';
import {
  IMMEDIATE_DELIVERY_LABEL,
  applyPolish,
  applyTranscript,
  attendanceApprovalError,
  deliveryApprovalError,
  deliveryCta,
  deliveryOptions,
} from '../src/lib/deliveryTiming.ts';

const edtSession = {
  startsAt: '2026-09-20T09:00:00-04:00',
  endsAt: '2026-09-20T10:00:00-04:00',
};

const estSession = {
  startsAt: '2026-11-08T09:00:00-05:00',
  endsAt: '2026-11-08T10:00:00-05:00',
};

function choice(event: typeof edtSession, id: 'now' | 'after_session' | 'tonight', now: string) {
  const option = deliveryOptions(event, new Date(now)).find((item) => item.choice === id);
  assert.ok(option);
  return option;
}

describe('club timezone delivery', () => {
  it('keeps both session-relative options before two hours after the session', () => {
    const now = '2026-09-20T15:00:00.000Z';
    const after = choice(edtSession, 'after_session', now);
    const tonight = choice(edtSession, 'tonight', now);
    assert.equal(after.available, true);
    assert.equal(tonight.available, true);
    assert.equal(CLUB_TIME_ZONE, 'America/New_York');
    assert.equal(zonedParts(after.at!).hour, 12);
    assert.equal(after.detail.includes('12:00 PM'), true);
    assert.equal(after.at?.toISOString(), '2026-09-20T16:00:00.000Z');
  });

  it('drops two hours after session once that time has passed, and keeps tonight', () => {
    const now = '2026-09-20T17:00:00.000Z';
    assert.equal(choice(edtSession, 'after_session', now).available, false);
    assert.equal(choice(edtSession, 'tonight', now).available, true);
    assert.equal(choice(edtSession, 'now', now).detail, IMMEDIATE_DELIVERY_LABEL);
  });

  it('drops every session-relative option after the session day has passed', () => {
    const now = '2026-10-01T23:52:00.000Z';
    const options = deliveryOptions(edtSession, new Date(now));
    assert.equal(options.find((item) => item.choice === 'now')?.available, true);
    assert.equal(options.find((item) => item.choice === 'now')?.detail, IMMEDIATE_DELIVERY_LABEL);
    assert.equal(options.find((item) => item.choice === 'after_session')?.available, false);
    assert.equal(options.find((item) => item.choice === 'tonight')?.available, false);
    assert.equal(deliveryCta(options[1], 13), 'Choose a delivery time');
    assert.equal(deliveryApprovalError(options[1]), 'That delivery time has passed. Choose another option.');
  });

  it('places a September session in Eastern Daylight Time', () => {
    const after = choice(edtSession, 'after_session', '2026-09-20T14:00:00.000Z');
    const parts = zonedParts(after.at!);
    assert.equal(parts.month, 9);
    assert.equal(parts.day, 20);
    assert.equal(parts.hour, 12);
    assert.equal(after.at?.toISOString(), '2026-09-20T16:00:00.000Z');
  });

  it('places a November session in Eastern Standard Time', () => {
    const after = choice(estSession, 'after_session', '2026-11-08T15:00:00.000Z');
    const tonight = choice(estSession, 'tonight', '2026-11-08T15:00:00.000Z');
    assert.equal(after.at?.toISOString(), '2026-11-08T17:00:00.000Z');
    assert.equal(tonight.at?.toISOString(), '2026-11-09T00:00:00.000Z');
    assert.equal(zonedParts(after.at!).hour, 12);
    assert.equal(zonedParts(tonight.at!).hour, 19);
    assert.equal(after.available, true);
    assert.equal(tonight.available, true);
  });
});

describe('approval gates', () => {
  it('blocks unrecorded attendance and zero recipients', () => {
    assert.match(attendanceApprovalError({ unrecordedCount: 2, recipientCount: 0 }) ?? '', /Attendance is still open/);
    assert.match(attendanceApprovalError({ unrecordedCount: 0, recipientCount: 0 }) ?? '', /Record attendance first/);
    assert.equal(attendanceApprovalError({ unrecordedCount: 0, recipientCount: 13 }), null);
  });

  it('keeps the editor when transcription or polish fails', () => {
    const draft = {
      message: 'Today the group worked on passing.',
      transcript: 'Okay so today',
      originalText: 'Okay so today',
      polishedText: '',
      polishMode: null,
    };
    assert.equal(applyTranscript(draft, 'failed', 'replacement'), draft);
    assert.equal(applyPolish(draft, { ok: false }), draft);
    const ready = applyTranscript(draft, 'ready', 'Okay so today the group passed.');
    assert.equal(ready.message, draft.message);
    assert.equal(ready.transcript, 'Okay so today the group passed.');
  });
});
