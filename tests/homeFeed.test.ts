import assert from 'node:assert/strict';
import test from 'node:test';

import { aroundClubEvents, conciseSupport, orderedPrograms, programStatusLine, youthRegistrationPrompt } from '../src/lib/homeFeed.ts';
import type { Person, Program, Registration, ScheduleEvent } from '../src/types/domain.ts';

const child = (id: string, firstName: string, dateOfBirth?: string): Person => ({
  id,
  firstName,
  lastName: 'Williams',
  displayName: firstName,
  dateOfBirth,
  isMinor: true,
});

const registration = (partial: Partial<Registration> & Pick<Registration, 'id' | 'programId' | 'participantIds'>): Registration => ({
  participantNames: [],
  submittedAt: '2026-09-01T00:00:00-04:00',
  status: 'approved',
  amountDue: 0,
  discountAmount: 0,
  paymentStatus: 'paid',
  demo: true,
  ...partial,
});

const program = (partial: Partial<Program> & Pick<Program, 'id'>): Program => ({
  slug: partial.id,
  title: partial.id,
  sport: 'soccer',
  audience: 'Club',
  summary: '',
  description: '',
  dates: 'Fall 2026',
  venue: 'Arrowhead',
  priceLabel: '',
  registrationOpen: false,
  heroImage: '',
  facts: [],
  includes: [],
  factual: true,
  ...partial,
});

test('registration stays off Home once a known child is enrolled or pending', () => {
  const maya = child('child-maya', 'Maya', '2018-04-12');
  const noah = child('child-noah', 'Noah', '2020-08-03');
  const enrolled = [
    registration({ id: 'maya', programId: 'fall-kids-2026', participantIds: ['child-maya'], status: 'approved' }),
    registration({ id: 'noah', programId: 'fall-kids-u6-2026', participantIds: ['child-noah'], status: 'approved' }),
  ];
  assert.equal(youthRegistrationPrompt('guardian', [maya, noah], enrolled, 'fall-kids-2026'), null);
  assert.equal(
    youthRegistrationPrompt('guardian', [maya], [registration({ id: 'wait', programId: 'fall-kids-2026', participantIds: ['child-maya'], status: 'pending' })], 'fall-kids-2026'),
    null,
  );
  assert.deepEqual(youthRegistrationPrompt('guest', [], [], 'fall-kids-2026'), { programId: 'fall-kids-2026' });
  assert.deepEqual(
    youthRegistrationPrompt('guardian', [child('child-new', 'Ava', '2019-01-01')], [], 'fall-kids-2026'),
    { programId: 'fall-kids-2026', childName: 'Ava' },
  );
  assert.equal(youthRegistrationPrompt('guardian', [child('child-unknown', 'Sam')], [], 'fall-kids-2026'), null);
});

test('supporting copy does not repeat the headline', () => {
  assert.equal(
    conciseSupport('The Open team plays Sunday night.', 'The Open team plays UNC International Academy.', 'UNC International Academy'),
    'vs UNC International Academy',
  );
  assert.equal(
    conciseSupport('The Open team plays Sunday night.', 'The Open team plays its final group match against UNC International Academy.', 'UNC International Academy'),
    'The Open team plays its final group match against UNC International Academy.',
  );
  assert.equal(conciseSupport('Ages 7–8 train Sunday morning.', 'Bring Shin guards, water, labeled jacket.'), 'Bring Shin guards, water, labeled jacket.');
});

test('club cards use one verified status and keep household programs first', () => {
  const kids = program({ id: 'kids', teamId: 'kids-team', registrationOpen: true, dates: 'Sundays' });
  const open = program({ id: 'open', teamId: 'men', registrationOpen: true });
  const idle = program({ id: 'women', dates: 'Sunday practice · no match season', registrationOpen: false });
  const next: ScheduleEvent = {
    id: 'next',
    type: 'league_match',
    sport: 'soccer',
    title: 'Open',
    subtitle: '',
    startsAt: '2026-10-04T22:00:00-04:00',
    venue: 'EC Lawrence',
    teamId: 'men',
    programId: 'open',
    status: 'scheduled',
  };
  const regs = [registration({ id: 'r', programId: 'kids', participantIds: ['child-maya'], teamId: 'kids-team' })];
  assert.equal(programStatusLine(kids, [], '2026-10-02T12:00:00-04:00', true), 'Sundays');
  assert.match(programStatusLine(open, [next], '2026-10-02T12:00:00-04:00', false), /^Next match/);
  assert.equal(programStatusLine(idle, [], '2026-10-02T12:00:00-04:00', false), 'No active match season');
  assert.deepEqual(orderedPrograms([open, kids], regs).map((item) => item.id), ['kids', 'open']);
});

test('around the club skips the primary event and stays at two items', () => {
  const event = (id: string, teamId: string, startsAt: string): ScheduleEvent => ({
    id,
    type: teamId.includes('women') ? 'training' : 'league_match',
    sport: teamId.includes('cricket') ? 'cricket' : 'soccer',
    title: id,
    subtitle: '',
    startsAt,
    venue: 'Field',
    teamId,
    status: 'scheduled',
  });
  const schedule = [
    event('kids', 'nova-royals-kids-u8', '2026-10-04T09:00:00-04:00'),
    event('open', 'nova-royals-men', '2026-10-04T22:00:00-04:00'),
    event('open-later', 'nova-royals-men', '2026-10-11T22:00:00-04:00'),
    event('plus', 'nova-royals-35plus', '2026-10-08T21:00:00-04:00'),
    event('women', 'nova-royals-women', '2026-10-04T08:00:00-04:00'),
  ];
  assert.deepEqual(aroundClubEvents(schedule, '2026-10-02T12:00:00-04:00', ['kids']).map((item) => item.id), ['open', 'plus']);
  assert.deepEqual(aroundClubEvents(schedule, '2026-10-02T12:00:00-04:00', ['open']).map((item) => item.id), ['plus', 'women']);
});
