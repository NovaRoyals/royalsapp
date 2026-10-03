import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  allowedTeamIds,
  audienceLabel,
  canCancelTeam,
  emptyDraft,
  homeHeadline,
  recipientEstimate,
  splitAnnouncements,
  templateFor,
  toAnnouncement,
  upcomingSessions,
  urgencyFor,
  validateDraft,
  viewerTeamIds,
  visibleTo,
  type Draft,
} from '../src/lib/announcements.ts';
import { addressedTo, categoryOf, partitionByPriority, shouldPush } from '../src/lib/notificationPriority.ts';
import type { Announcement, NotificationPrefs, ScheduleEvent } from '../src/types/domain.ts';

const NOW = new Date('2026-10-03T12:00:00-04:00');

function announcement(patch: Partial<Announcement>): Announcement {
  return { id: 'a', title: 'T', body: 'B', audience: 'club', scopeLabel: 'Nova Royals', publishedAt: '2026-10-02T12:00:00-04:00', ...patch };
}

describe('who may write to whom', () => {
  it('lets only the club office write to the whole club', () => {
    assert.equal(validateDraft({ ...emptyDraft('admin'), title: 'Hi', body: 'There' }, 'admin'), null);
    assert.match(validateDraft({ ...emptyDraft('coach'), scope: 'club', title: 'Hi', body: 'There' }, 'coach')!, /whole club/);
  });

  it('keeps a coach to their own teams', () => {
    assert.deepEqual(allowedTeamIds('coach'), ['nova-royals-kids-u8', 'nova-royals-kids-u6']);
    const draft: Draft = { ...emptyDraft('coach'), teamIds: ['nova-royals-women'], title: 'Hi', body: 'There' };
    assert.match(validateDraft(draft, 'coach')!, /own teams/);
  });

  it('gives parents, players and guests no way to send', () => {
    for (const role of ['guardian', 'adult_player', 'guest', 'volunteer'] as const) {
      assert.match(validateDraft({ ...emptyDraft('admin'), title: 'Hi', body: 'There' }, role)!, /Only coaches/);
    }
  });

  it('asks for the basics', () => {
    const base = { ...emptyDraft('coach') };
    assert.match(validateDraft({ ...base, title: '', body: 'x' }, 'coach')!, /headline/);
    assert.match(validateDraft({ ...base, title: 'x', body: '' }, 'coach')!, /message/);
    assert.match(validateDraft({ ...base, teamIds: [], title: 'x', body: 'x' }, 'coach')!, /team/);
    assert.match(validateDraft({ ...base, title: 'x'.repeat(81), body: 'x' }, 'coach')!, /80/);
  });
});

describe('cancellations', () => {
  const cancel: Draft = { ...emptyDraft('coach'), kind: 'cancellation', teamIds: ['nova-royals-kids-u8'], eventIds: ['e1'], reason: 'Weather', title: 'Cancelled', body: 'Off.' };

  it('need a session and a reason', () => {
    assert.equal(validateDraft(cancel, 'coach'), null);
    assert.match(validateDraft({ ...cancel, eventIds: [] }, 'coach')!, /session/);
    assert.match(validateDraft({ ...cancel, reason: '' }, 'coach')!, /why/);
  });

  it('can never be a whole-club message', () => {
    assert.match(validateDraft({ ...cancel, scope: 'club' }, 'admin')!, /team and session/);
  });

  it('are the one kind that is always urgent', () => {
    assert.equal(urgencyFor(cancel), 'urgent');
    assert.equal(urgencyFor({ ...cancel, kind: 'weather' }), 'high');
    assert.equal(urgencyFor({ ...cancel, kind: 'update', important: false }), 'normal');
    assert.equal(urgencyFor({ ...cancel, kind: 'update', important: true }), 'high');
  });

  it('let a coach cancel their own team and nobody else’s', () => {
    assert.equal(canCancelTeam('coach', 'nova-royals-kids-u8'), true);
    assert.equal(canCancelTeam('coach', 'nova-royals-women'), false);
    assert.equal(canCancelTeam('admin', 'nova-royals-women'), true);
    assert.equal(canCancelTeam('guardian', 'nova-royals-kids-u8'), false);
  });
});

describe('who sees an announcement', () => {
  const club = announcement({});
  const u8 = announcement({ audience: 'team', teamIds: ['nova-royals-kids-u8'], scopeLabel: 'U8' });
  const youthOnly = announcement({ groups: ['youth_families'] });
  const legacyTeam = announcement({ audience: 'team', teamId: 'nova-royals-men' });
  const legacyProgram = announcement({ audience: 'program', programId: 'fall-kids-2026', teamId: 'nova-royals-kids-u8' });

  const parentU8 = { role: 'guardian' as const, teamIds: viewerTeamIds('guardian', ['nova-royals-kids-u8']) };
  const parentU6 = { role: 'guardian' as const, teamIds: viewerTeamIds('guardian', ['nova-royals-kids-u6']) };
  const player = { role: 'adult_player' as const, teamIds: viewerTeamIds('adult_player', []) };
  const guest = { role: 'guest' as const, teamIds: [] as string[] };

  it('shows club news to everyone, narrowed by group when it was', () => {
    for (const viewer of [parentU8, player, guest]) assert.equal(visibleTo(club, viewer), true);
    assert.equal(visibleTo(youthOnly, parentU8), true);
    assert.equal(visibleTo(youthOnly, player), false);
    assert.equal(visibleTo(youthOnly, guest), false);
  });

  it('keeps a team announcement to that team', () => {
    assert.equal(visibleTo(u8, parentU8), true);
    assert.equal(visibleTo(u8, parentU6), false);
    assert.equal(visibleTo(u8, player), false);
    assert.equal(visibleTo(u8, guest), false);
    assert.equal(visibleTo(u8, { role: 'coach', teamIds: viewerTeamIds('coach', []) }), true);
    assert.equal(visibleTo(u8, { role: 'admin', teamIds: [] }), true);
  });

  it('reads older announcements that only had a teamId or a program', () => {
    assert.equal(visibleTo(legacyTeam, player), true);
    assert.equal(visibleTo(legacyTeam, parentU8), false);
    assert.equal(visibleTo(legacyProgram, parentU8), true);
    assert.equal(visibleTo(legacyProgram, parentU6), true);
    assert.equal(visibleTo(legacyProgram, player), false);
  });

  it('labels the audience in plain words', () => {
    assert.equal(audienceLabel(club), 'Whole club');
    assert.equal(audienceLabel(youthOnly), 'Club · youth families');
    assert.equal(audienceLabel(u8), 'Kids U8');
    assert.equal(audienceLabel(announcement({ audience: 'team', teamIds: ['nova-royals-kids-u8', 'nova-royals-kids-u6'] })), 'Kids U8 + Kids U6');
  });

  it('estimates reach only where the count is known', () => {
    const draft = { scope: 'teams' as const, groups: [], teamIds: ['nova-royals-kids-u8'] };
    assert.equal(recipientEstimate(draft, { 'nova-royals-kids-u8': 17 }), 'Kids U8 · 17 people');
    assert.equal(recipientEstimate({ ...draft, teamIds: ['nova-royals-kids-u8', 'nova-royals-kids-u6'] }, { 'nova-royals-kids-u8': 17 }), 'Kids U8 + Kids U6');
  });
});

describe('latest and past', () => {
  it('moves ordinary news to Past after a week and urgent news after two', () => {
    const fresh = announcement({ id: 'fresh', publishedAt: '2026-10-01T09:00:00-04:00' });
    const stale = announcement({ id: 'stale', publishedAt: '2026-09-20T09:00:00-04:00' });
    const urgent = announcement({ id: 'urgent', publishedAt: '2026-09-25T09:00:00-04:00', urgency: 'urgent' });
    const pinned = announcement({ id: 'pinned', publishedAt: '2026-09-01T09:00:00-04:00', pinned: true });
    const { latest, past } = splitAnnouncements([stale, fresh, urgent, pinned], NOW);
    assert.deepEqual(latest.map((item) => item.id), ['pinned', 'fresh', 'urgent']);
    assert.deepEqual(past.map((item) => item.id), ['stale']);
  });

  it('puts a fresh cancellation above pinned news', () => {
    const pinned = announcement({ id: 'pinned', publishedAt: '2026-09-13T09:00:00-04:00', pinned: true });
    const cancel = announcement({ id: 'cancel', kind: 'cancellation', publishedAt: '2026-10-03T09:00:00-04:00' });
    const older = announcement({ id: 'older', kind: 'cancellation', publishedAt: '2026-09-25T09:00:00-04:00' });
    assert.deepEqual(splitAnnouncements([pinned, older, cancel], NOW).latest.map((item) => item.id), ['cancel', 'pinned', 'older']);
  });

  it('leads Home with a recent cancellation before anything else', () => {
    const viewer = { role: 'guardian' as const, teamIds: ['nova-royals-kids-u8'] };
    const weather = announcement({ id: 'w', kind: 'weather', audience: 'team', teamIds: ['nova-royals-kids-u8'], publishedAt: '2026-10-03T08:00:00-04:00' });
    const cancel = announcement({ id: 'c', kind: 'cancellation', audience: 'team', teamIds: ['nova-royals-kids-u8'], publishedAt: '2026-10-02T20:00:00-04:00' });
    const other = announcement({ id: 'o', kind: 'cancellation', audience: 'team', teamIds: ['nova-royals-women'], publishedAt: '2026-10-03T09:00:00-04:00' });
    const old = announcement({ id: 'old', kind: 'cancellation', audience: 'team', teamIds: ['nova-royals-kids-u8'], publishedAt: '2026-09-20T09:00:00-04:00' });
    assert.equal(homeHeadline([weather, cancel, other, old], viewer, NOW)?.id, 'c');
    assert.equal(homeHeadline([other, old], viewer, NOW), undefined);
  });
});

describe('writing one', () => {
  it('starts a cancellation with words a coach only has to check', () => {
    const text = templateFor('cancellation', { team: 'Kids U8', session: 'Sunday’s 9:00 AM training', reason: 'Weather' });
    assert.equal(text.title, 'Cancelled: Sunday’s 9:00 AM training');
    assert.match(text.body, /is cancelled because of the weather/);
  });

  it('turns a draft into an announcement with its audience and author', () => {
    const draft: Draft = { ...emptyDraft('coach'), kind: 'cancellation', teamIds: ['nova-royals-kids-u8'], eventIds: ['e1'], reason: 'Weather', title: ' Cancelled ', body: ' Off. ' };
    const made = toAnnouncement(draft, { name: 'Coach Priya', role: 'coach' });
    assert.equal(made.audience, 'team');
    assert.equal(made.title, 'Cancelled');
    assert.deepEqual(made.teamIds, ['nova-royals-kids-u8']);
    assert.deepEqual(made.eventIds, ['e1']);
    assert.equal(made.urgency, 'urgent');
    assert.equal(made.scopeLabel, 'Kids U8');
  });

  it('offers the next sessions for the chosen teams, not cancelled or finished ones', () => {
    const event = (id: string, startsAt: string, status: ScheduleEvent['status'] = 'scheduled', teamId = 'nova-royals-kids-u8'): ScheduleEvent => ({
      id, type: 'training', sport: 'soccer', title: id, subtitle: '', startsAt, venue: 'V', teamId, status,
    });
    const list = upcomingSessions(
      [event('later', '2026-10-11T09:00:00-04:00'), event('next', '2026-10-04T09:00:00-04:00'), event('done', '2026-09-27T09:00:00-04:00', 'completed'), event('off', '2026-10-05T09:00:00-04:00', 'cancelled'), event('other', '2026-10-04T08:00:00-04:00', 'scheduled', 'nova-royals-women')],
      ['nova-royals-kids-u8'],
      NOW,
    );
    assert.deepEqual(list.map((item) => item.id), ['next', 'later']);
  });
});

describe('alerts that cannot be muted', () => {
  const prefs = (patch: Partial<NotificationPrefs> = {}): NotificationPrefs => ({ urgent: true, team: true, community: true, locationShare: false, ...patch });
  const off = prefs({ team: false, community: false });

  it('puts cancellations and field closures in the top tier', () => {
    assert.equal(categoryOf({ type: 'change', urgency: 'urgent' }), 'critical');
    assert.equal(categoryOf({ type: 'field', urgency: 'normal' }), 'critical');
    assert.equal(categoryOf({ type: 'announcement', urgency: 'normal', category: 'critical' }), 'critical');
  });

  it('keeps messages, schedule changes and weather in the middle', () => {
    for (const type of ['message', 'coach_update', 'weather', 'change'] as const) assert.equal(categoryOf({ type, urgency: 'normal' }), 'important', type);
    assert.equal(categoryOf({ type: 'announcement', urgency: 'high' }), 'important');
  });

  it('still pushes a critical alert when everything is switched off', () => {
    assert.equal(shouldPush({ type: 'change', urgency: 'urgent' }, off), true);
    assert.equal(shouldPush({ type: 'message', urgency: 'normal' }, off), false);
    assert.equal(shouldPush({ type: 'announcement', urgency: 'low' }, off), false);
    assert.equal(shouldPush({ type: 'message', urgency: 'normal' }, prefs()), true);
  });

  it('lifts critical alerts to the top of the list', () => {
    const list = [
      { type: 'announcement' as const, urgency: 'normal' as const, read: true, createdAt: '2026-10-01T09:00:00-04:00' },
      { type: 'change' as const, urgency: 'urgent' as const, read: false, createdAt: '2026-10-03T09:00:00-04:00' },
      { type: 'change' as const, urgency: 'urgent' as const, read: true, createdAt: '2026-09-01T09:00:00-04:00' },
    ];
    const { critical, rest } = partitionByPriority(list, NOW);
    assert.equal(critical.length, 1);
    assert.equal(rest.length, 2);
  });

  it('addresses an alert to the roles and teams it was written for', () => {
    const forU8Parents = { roles: ['guardian' as const], teamIds: ['nova-royals-kids-u8'] };
    assert.equal(addressedTo(forU8Parents, 'guardian', ['nova-royals-kids-u8']), true);
    assert.equal(addressedTo(forU8Parents, 'guardian', ['nova-royals-kids-u6']), false);
    assert.equal(addressedTo(forU8Parents, 'adult_player', ['nova-royals-kids-u8']), false);
    assert.equal(addressedTo(forU8Parents, 'admin', []), true);
    assert.equal(addressedTo({}, 'guest', []), true);
  });
});
