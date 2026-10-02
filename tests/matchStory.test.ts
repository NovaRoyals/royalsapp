import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { contextualStory, manualStory, type StoryViewer } from '../src/lib/matchStory.ts';
import type { ScheduleEvent } from '../src/types/domain.ts';

const guest: StoryViewer = {
  role: 'guest',
  rostered: false,
  responded: true,
  childNeedsResponse: false,
  supporterGoing: false,
  canSeeSquad: false,
};

const player: StoryViewer = { ...guest, role: 'adult_player', rostered: true, responded: false, canSeeSquad: true };
const parent: StoryViewer = { ...guest, role: 'guardian', childNeedsResponse: true, childName: 'Maya' };
const supporter: StoryViewer = { ...guest, role: 'adult_player', rostered: false, canSeeSquad: false };
const coach: StoryViewer = { ...guest, role: 'coach', rostered: true, canSeeSquad: true };

function event(patch: Partial<ScheduleEvent>): ScheduleEvent {
  return {
    id: 'fixture',
    type: 'league_match',
    sport: 'soccer',
    title: 'Nova Royals AC (Open) vs UNC International Academy',
    subtitle: 'Visitor',
    startsAt: '2026-10-04T22:00:00-04:00',
    venue: 'EC Lawrence Park · Field 3A',
    teamId: 'nova-royals-men',
    opponent: 'UNC International Academy',
    status: 'scheduled',
    supporterCount: 12,
    ...patch,
  };
}

describe('contextual home stories', () => {
  it('uses neutral language when stakes are not verified', () => {
    const story = contextualStory(event({}), guest);
    assert.equal(story.headline, 'The Open team plays Sunday night.');
    assert.equal(story.supporting, 'The Open team plays UNC International Academy.');
    assert.equal(story.signal, '12 supporters coming');
    assert.equal(story.action?.label, 'Sign in to RSVP');
    assert.equal(story.source, 'derived');
    assert.equal(story.headline.includes('through'), false);
  });

  it('states qualification only from verified facts', () => {
    const story = contextualStory(event({
      storyFacts: { angle: 'qualification', stageLabel: 'Playoffs', finalGroup: true, winAdvances: true },
    }), guest);
    assert.equal(story.eyebrow, 'OPEN · PLAYOFFS');
    assert.equal(story.headline, 'Win and ROYALS are through.');
    assert.equal(story.supporting, 'The Open team plays its final group match against UNC International Academy.');
  });

  it('keeps 35+, cricket, youth, and training in their own voice', () => {
    assert.equal(contextualStory(event({ teamId: 'nova-royals-35plus', opponent: 'Mandio-k', startsAt: '2026-10-01T21:00:00-04:00' }), guest).headline, 'The 35+ side plays Thursday night.');
    assert.equal(contextualStory(event({ sport: 'cricket', teamId: 'nova-royals-cricket', opponent: 'Aces', startsAt: '2026-10-03T13:00:00-04:00', title: 'ROYALS vs Aces' }), guest).headline, 'ROYALS Cricket play Saturday afternoon.');
    assert.equal(contextualStory(event({ type: 'tournament_match', teamId: 'nova-royals-kids-u8', ageGroup: 'Ages 7–8', opponent: 'A showcase side', startsAt: '2026-10-17T09:00:00-04:00', storyFacts: { angle: 'elimination', lossEliminates: true } }), guest).headline, 'Ages 7–8 take the field Saturday morning.');
    assert.match(contextualStory(event({ type: 'training', teamId: 'nova-royals-kids-u8', ageGroup: 'Ages 7–8', opponent: undefined, whatToBring: 'shin guards', startsAt: '2026-10-04T09:00:00-04:00' }), guest).supporting, /shin guards/);
  });

  it('does not invent a dramatic claim when the angle has no rule', () => {
    const story = contextualStory(event({ storyFacts: { angle: 'qualification' } }), guest);
    assert.equal(story.headline, 'The Open team plays Sunday night.');
  });

  it('uses a manual headline without showing that it was written by hand', () => {
    const story = contextualStory(event({
      storyOverride: manualStory({ headline: 'Bring a chair.', supporting: 'The Open side plays at EC Lawrence.', featured: true, showSupporterCta: true }),
    }), guest);
    assert.equal(story.headline, 'Bring a chair.');
    assert.equal(story.source, 'manual');
    assert.equal(JSON.stringify(story).includes('manual'), true);
  });

  it('keeps squad counts off guest and cross-program cards', () => {
    const withSquad = event({ goingCount: 8 });
    assert.equal(contextualStory(withSquad, guest).signal, '12 supporters coming');
    assert.equal(contextualStory(withSquad, supporter).signal, '12 supporters coming');
    assert.equal(contextualStory(withSquad, player).signal, '8 players going');
    assert.equal(contextualStory(withSquad, coach).signal, '8 players going');
  });

  it('picks one action for the viewer', () => {
    assert.equal(contextualStory(event({}), player).action?.label, 'Respond for this match');
    assert.equal(contextualStory(event({ teamId: 'nova-royals-kids-u8', ageGroup: 'Ages 7–8', type: 'training' }), parent).action?.label, 'Respond for Maya');
    assert.equal(contextualStory(event({}), { ...supporter, supporterGoing: true }).action?.label, "You're coming");
    assert.equal(contextualStory(event({ storyOverride: manualStory({ headline: 'Tonight', showSupporterCta: false }) }), supporter).action, undefined);
  });
});
