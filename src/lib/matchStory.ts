import { formatEventParts } from './datetime';
import type { MatchStoryOverride, ScheduleEvent, UserRole } from '../types/domain';

const WEEKDAY: Record<string, string> = {
  SUN: 'Sunday',
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
};

export interface StoryViewer {
  role: UserRole;
  rostered: boolean;
  responded: boolean;
  childNeedsResponse: boolean;
  childName?: string;
  supporterGoing: boolean;
  canSeeSquad: boolean;
}

export interface ContextualStory {
  eyebrow: string;
  headline: string;
  supporting: string;
  facts: string;
  signal?: string;
  action?: { label: string; kind: 'signin' | 'rsvp' | 'ops' | 'support' };
  source: 'derived' | 'manual';
}

function dayPhrase(event: ScheduleEvent) {
  const parts = formatEventParts(event.startsAt);
  const day = WEEKDAY[parts.weekday] ?? parts.weekday;
  const hour = Number(event.startsAt.slice(11, 13));
  const part = hour >= 17 ? 'night' : hour < 12 ? 'morning' : 'afternoon';
  return { day, part, time: parts.time, phrase: `${day} ${part}` };
}

function youth(event: ScheduleEvent) {
  return Boolean(event.teamId?.includes('kids') || event.ageGroup || event.division?.toLowerCase().includes('u8'));
}

function training(event: ScheduleEvent) {
  return event.type === 'training';
}

function women(event: ScheduleEvent) {
  return Boolean(event.teamId?.includes('women'));
}

function openTeam(event: ScheduleEvent) {
  return Boolean(event.teamId?.includes('men') && !women(event));
}

function programName(event: ScheduleEvent) {
  if (event.sport === 'cricket') return 'ROYALS Cricket';
  if (event.teamId?.includes('35')) return 'The 35+ side';
  if (youth(event)) return event.ageGroup || 'The group';
  if (women(event)) return 'The women’s team';
  if (openTeam(event)) return 'The Open team';
  return 'ROYALS';
}

function eyebrow(event: ScheduleEvent) {
  const base = event.sport === 'cricket'
    ? 'CRICKET'
    : event.teamId?.includes('35')
      ? '35+'
      : youth(event)
        ? (event.ageGroup || 'YOUTH').toUpperCase()
        : women(event)
          ? 'WOMEN'
          : openTeam(event)
            ? 'OPEN'
            : training(event)
              ? 'TRAINING'
              : 'ROYALS';
  const stage = event.storyFacts?.stageLabel?.trim();
  return stage ? `${base} · ${stage.toUpperCase()}` : base;
}

function supportingLine(event: ScheduleEvent) {
  const name = programName(event);
  if (training(event)) {
    return event.whatToBring ? `Bring ${event.whatToBring}.` : 'Check the session card for what to bring.';
  }
  if (event.opponent) {
    if (!youth(event) && !training(event) && event.storyFacts?.finalGroup) {
      return `${name} plays its final group match against ${event.opponent}.`;
    }
    return `${name} plays ${event.opponent}.`;
  }
  return event.title;
}

function derivedHeadline(event: ScheduleEvent) {
  const when = dayPhrase(event);
  const name = programName(event);
  if (training(event)) return `${name} train ${when.phrase}.`;
  const facts = youth(event) ? undefined : event.storyFacts;
  if (facts?.angle === 'elimination' && facts.lossEliminates) return 'Win or the side is out.';
  if (facts?.angle === 'qualification' && facts.winAdvances) return 'Win and ROYALS are through.';
  if (facts?.angle === 'final_group') return `The final group match is ${when.day}.`;
  if (facts?.angle === 'final') return 'This is the final.';
  if (facts?.angle === 'semifinal') return 'This is the semifinal.';
  if (facts?.angle === 'opener') return 'This is the season opener.';
  if (facts?.angle === 'recent_result' && facts.previousResult?.trim()) return facts.previousResult.trim();
  if (event.sport === 'cricket') return `ROYALS Cricket play ${when.phrase}.`;
  if (event.teamId?.includes('35')) return `The 35+ side plays ${when.phrase}.`;
  if (youth(event)) return `${name} take the field ${when.phrase}.`;
  if (women(event)) return `The women’s team play ${when.phrase}.`;
  if (openTeam(event)) return `The Open team plays ${when.phrase}.`;
  return `${name} play ${when.phrase}.`;
}

export function contextualStory(event: ScheduleEvent, viewer: StoryViewer): ContextualStory {
  const when = dayPhrase(event);
  const manual = event.storyOverride?.headline?.trim() ? event.storyOverride : undefined;
  const headline = manual ? manual.headline.trim() : derivedHeadline(event);
  const supporting = manual?.supporting?.trim() || supportingLine(event);
  const signal = viewer.canSeeSquad && typeof event.goingCount === 'number'
    ? `${event.goingCount} players going`
    : typeof event.supporterCount === 'number'
      ? `${event.supporterCount} ${event.supporterCount === 1 ? 'supporter' : 'supporters'} coming`
      : undefined;
  return {
    eyebrow: eyebrow(event),
    headline,
    supporting,
    facts: `${when.day} · ${when.time} · ${event.venue}`,
    signal,
    action: primaryAction(event, viewer),
    source: manual ? 'manual' : 'derived',
  };
}

function primaryAction(event: ScheduleEvent, viewer: StoryViewer): ContextualStory['action'] {
  if (viewer.role === 'guest') return { label: 'Sign in to RSVP', kind: 'signin' };
  if (viewer.rostered && !viewer.responded) return { label: 'Respond for this match', kind: 'rsvp' };
  if (viewer.childNeedsResponse) {
    return { label: viewer.childName ? `Respond for ${viewer.childName}` : 'Respond for this session', kind: 'rsvp' };
  }
  if ((viewer.role === 'coach' || viewer.role === 'competition_manager' || viewer.role === 'admin') && viewer.rostered) {
    return { label: 'Team status', kind: 'ops' };
  }
  if (event.storyOverride?.showSupporterCta === false) return undefined;
  if (viewer.supporterGoing) return { label: "You're coming", kind: 'support' };
  return { label: 'Come support', kind: 'support' };
}

export function storyViewerFor(input: {
  role: UserRole;
  event: ScheduleEvent;
  childId?: string;
  childName?: string;
}): StoryViewer {
  const rostered = input.role === 'admin'
    || (input.role === 'coach' && Boolean(input.event.teamId?.includes('kids')))
    || (input.role === 'competition_manager' && Boolean(input.event.teamId))
    || (input.role === 'adult_player' && input.event.teamId === 'nova-royals-men');
  const childRsvp = input.childId
    ? input.event.participantRsvps?.find((item) => item.personId === input.childId)
    : undefined;
  const onChildEvent = Boolean(input.childId && (input.event.participantIds?.includes(input.childId) || input.event.teamId?.includes('kids')));
  return {
    role: input.role,
    rostered,
    responded: input.role === 'adult_player' ? Boolean(input.event.attendance) : true,
    childNeedsResponse: input.role === 'guardian' && onChildEvent && !childRsvp,
    childName: input.childName,
    supporterGoing: Boolean(input.event.supporterGoing),
    canSeeSquad: input.role === 'admin'
      || input.role === 'competition_manager'
      || (input.role === 'coach' && Boolean(input.event.teamId?.includes('kids')))
      || (input.role === 'adult_player' && input.event.teamId === 'nova-royals-men'),
  };
}

export function manualStory(override: Pick<MatchStoryOverride, 'headline' | 'supporting' | 'featured' | 'showSupporterCta'>): MatchStoryOverride {
  return { ...override, source: 'manual' };
}
