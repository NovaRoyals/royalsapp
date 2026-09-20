import type { Person, ScheduleEvent, UserRole } from '@/types/domain';
import {
  addMinutesToWall,
  clubNowIso,
  clubNowPostedIso,
  estimatedTravelStub,
  eventPhase,
  formatEventParts,
  formatLeaveBy,
  isSameWallDay,
  relativeDayLabel,
} from '@/lib/datetime';
import { fieldStatusLabel, weatherForEvent } from '@/services/weather';

export function travelMinutesStub(venue: string) {
  if (venue.toLowerCase().includes('nottoway') || venue.toLowerCase().includes('training')) return 18;
  if (venue.toLowerCase().includes('arrowhead')) return 22;
  if (venue.toLowerCase().includes('manassas') || venue.toLowerCase().includes('cricket')) return 38;
  return 22;
}

export function leaveByIso(startsAt: string, venue: string, bufferMin = 10) {
  return addMinutesToWall(startsAt, -(travelMinutesStub(venue) + bufferMin));
}

export function ageOnDate(dateOfBirth: string, asOfIso = clubNowPostedIso().slice(0, 10)) {
  const birth = new Date(dateOfBirth);
  const asOf = new Date(asOfIso);
  let age = asOf.getFullYear() - birth.getFullYear();
  const month = asOf.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && asOf.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function recommendKidsGroup(dateOfBirth?: string) {
  if (!dateOfBirth) return { group: 'Ask coach', ages: '3–16', match: true as boolean };
  const age = ageOnDate(dateOfBirth);
  if (age < 3 || age > 16) return { group: 'Outside 3–16', ages: `${age}`, match: false };
  if (age <= 4) return { group: 'U5 play', ages: `${age}`, match: true };
  if (age <= 6) return { group: 'U7 · ages 5–6', ages: `${age}`, match: true };
  if (age <= 8) return { group: 'U8 · ages 7–8', ages: `${age}`, match: true };
  if (age <= 10) return { group: 'U10 · ages 9–10', ages: `${age}`, match: true };
  if (age <= 12) return { group: 'U12 · ages 11–12', ages: `${age}`, match: true };
  return { group: 'U14–U16', ages: `${age}`, match: true };
}

export function eventsOverlap(a: ScheduleEvent, b: ScheduleEvent, minutes = 30) {
  const aStart = new Date(a.startsAt).getTime();
  const aEnd = new Date(a.endsAt ?? a.startsAt).getTime() || aStart + 75 * 60_000;
  const bStart = new Date(b.startsAt).getTime();
  const bEnd = new Date(b.endsAt ?? b.startsAt).getTime() || bStart + 75 * 60_000;
  const overlap = Math.min(aEnd, bEnd) - Math.max(aStart, bStart);
  return overlap >= minutes * 60_000;
}

export function householdConflictStub(role: UserRole, childNames: string[] = []) {
  if (role !== 'guardian') return null;
  if (!childNames.includes('Maya') || !childNames.includes('Noah')) return null;
  return {
    title: 'Schedule conflict',
    detail: 'Maya’s training and Noah’s U6 group overlap by 30 minutes. Household calendar stub — not a published club fixture.',
  };
}

export function householdConflicts(events: ScheduleEvent[]) {
  const scheduled = events.filter((item) => item.status === 'scheduled');
  for (let i = 0; i < scheduled.length; i += 1) {
    for (let j = i + 1; j < scheduled.length; j += 1) {
      if (eventsOverlap(scheduled[i], scheduled[j])) {
        return {
          a: scheduled[i],
          b: scheduled[j],
          minutes: 30,
        };
      }
    }
  }
  return null;
}

export function minutesUntil(startsAt: string, nowIso = clubNowIso()) {
  return Math.round((new Date(startsAt).getTime() - new Date(nowIso).getTime()) / 60000);
}

export function isGameDayWindow(event: ScheduleEvent | undefined, nowIso = clubNowIso()) {
  if (!event || event.status !== 'scheduled') return false;
  const mins = minutesUntil(event.startsAt, nowIso);
  return mins > 0 && mins <= 120;
}

export function gameDayBrief(event: ScheduleEvent, childName?: string, nowIso = clubNowIso()) {
  const parts = formatEventParts(event.startsAt);
  const leaveBy = formatLeaveBy(event.startsAt, travelMinutesStub(event.venue) + 10, nowIso);
  const weather = weatherForEvent(event);
  const mins = travelMinutesStub(event.venue);
  return {
    headline: childName ? `${childName}’s practice begins at ${parts.time}` : `${event.title} · ${parts.time}`,
    drive: `${mins}-minute drive · ${estimatedTravelStub(event.venue)}`,
    leaveBy,
    field: `Field ${fieldStatusLabel(event.fieldStatus)}`,
    weather: weather.summary.includes('°') ? weather.summary : `${weather.summary} · 74°F stub`,
    bring: event.whatToBring
      ? `${event.whatToBring}${weather.summary.toLowerCase().includes('mild') ? ' · light jacket' : ''}`
      : weather.summary.toLowerCase().includes('mild')
        ? 'Light jacket'
        : 'Check your session card',
    minutesOut: minutesUntil(event.startsAt, nowIso),
    dayLabel: relativeDayLabel(event.startsAt),
  };
}

export const WEEK_WINDOW_MINUTES = 7 * 24 * 60;

export function upcomingThisWeek(schedule: ScheduleEvent[], nowIso = clubNowIso()) {
  return schedule.filter((item) => {
    if (item.status === 'cancelled' || item.status === 'completed') return false;
    if (eventPhase(item, nowIso) !== 'upcoming') return false;
    const minutes = minutesUntil(item.startsAt, nowIso);
    return minutes < WEEK_WINDOW_MINUTES;
  });
}

export function aroundTheClub(schedule: ScheduleEvent[], _followedIds: string[], nowIso = clubNowIso()) {
  const week = upcomingThisWeek(schedule, nowIso);
  const cricket = week.find((item) => item.sport === 'cricket');
  const feature = cricket ?? week.find((item) => item.teamId !== 'nova-royals-kids-u8' && item.sport !== 'soccer') ?? week.find((item) => item.teamId === 'nova-royals-men' || item.teamId === 'nova-royals-35plus');
  if (!feature) return null;
  const parts = formatEventParts(feature.startsAt);
  return {
    title: feature.title,
    detail: `${parts.weekday} ${parts.time} · ${feature.supporterCount ?? 0} Royals are going`,
    href: `/event/${feature.id}`,
    eventId: feature.id,
  };
}

export function crossClubSuggestion(role: UserRole, followedIds: string[], schedule: ScheduleEvent[], nowIso = clubNowIso()) {
  return aroundTheClub(schedule, followedIds, nowIso);
}

export function siblingPrice(count: number) {
  if (count <= 0) return { total: 0, discount: 0, note: 'Select a child' };
  const total = 120 + Math.max(0, count - 1) * 60;
  const discount = count * 120 - total;
  const note = count > 1 ? `Sibling rate applied · you save $${discount}` : 'First child $120 · siblings $60';
  return { total, discount, note };
}

export function childRegistrationHints(children: Person[]) {
  return children.map((child) => {
    const rec = recommendKidsGroup(child.dateOfBirth);
    return {
      id: child.id,
      name: child.firstName,
      ...rec,
      warning: rec.match ? null : `${child.firstName} is outside the 3–16 age range for Fall Soccer Training.`,
    };
  });
}

export type HomeStory = {
  id: string;
  kicker: string;
  title: string;
  meta: string;
  href: string;
  startsAt: string;
  kind: 'upcoming' | 'live' | 'result';
};

function cricketHref(event: ScheduleEvent) {
  if (event.id === 'ccpl-2026-09-20') return '/cricket/match/4806';
  if (event.id === 'ccpl-2026-09-26') return '/cricket/match/shockers';
  if (event.id === 'ccpl-2026-09-12') return '/cricket/match/4777';
  return `/event/${event.id}`;
}

export function nextUpcomingEvent(events: ScheduleEvent[], nowIso = clubNowIso()) {
  return nextOf(events, nowIso);
}

function nextOf(events: ScheduleEvent[], nowIso: string) {
  return events
    .filter((item) => eventPhase(item, nowIso) === 'upcoming')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
}

function upcomingStory(event: ScheduleEvent, kicker: string): HomeStory {
  const parts = formatEventParts(event.startsAt);
  const rel = relativeDayLabel(event.startsAt);
  const hour = Number(event.startsAt.slice(11, 13));
  const when =
    rel === 'today' ? (hour >= 17 ? 'Tonight' : 'Today') : rel === 'tomorrow' ? 'Tomorrow' : `${parts.weekday} ${parts.month} ${parts.day}`;
  return {
    id: `up-${event.id}`,
    kicker,
    title: event.title,
    meta: `${when} · ${parts.time}${event.venue ? ` · ${event.venue}` : ''}`,
    href: event.sport === 'cricket' ? cricketHref(event) : `/event/${event.id}`,
    startsAt: event.startsAt,
    kind: 'upcoming',
  };
}

function cricketTodayStory(event: ScheduleEvent, nowIso: string): HomeStory | null {
  const phase = eventPhase(event, nowIso);
  const parts = formatEventParts(event.startsAt);
  if (phase === 'upcoming') return null;
  if (phase === 'live') {
    return {
      id: `live-${event.id}`,
      kicker: 'In play',
      title: event.title,
      meta: 'Official live score is on CCPL — ROYALS does not guess the score.',
      href: cricketHref(event),
      startsAt: event.startsAt,
      kind: 'live',
    };
  }
  if (event.result) {
    const line = event.result.replace(/^Lost — /, 'Lost today — ').replace(/^Won by /, 'Won today by ').replace(/^Tied — /, 'Tied today — ');
    return {
      id: `done-${event.id}`,
      kicker: 'Today',
      title: `Cricket · ${line}`,
      meta: `${parts.time} · ${event.venue}`,
      href: cricketHref(event),
      startsAt: event.startsAt,
      kind: 'result',
    };
  }
  return {
    id: `done-${event.id}`,
    kicker: 'Today',
    title: event.title,
    meta: 'Match window is over. Result waits on the official CCPL scorecard.',
    href: cricketHref(event),
    startsAt: event.startsAt,
    kind: 'result',
  };
}

export function homeStories(
  schedule: ScheduleEvent[],
  role: UserRole,
  hasChildren: boolean,
  nowIso = clubNowIso(),
): HomeStory[] {
  const posted = clubNowPostedIso();
  const men = schedule.filter((item) => item.teamId === 'nova-royals-men');
  const plus = schedule.filter((item) => item.teamId === 'nova-royals-35plus');
  const kids = schedule.filter((item) => item.teamId === 'nova-royals-kids-u8');
  const cricket = schedule.filter((item) => item.sport === 'cricket');
  const cards: HomeStory[] = [];
  const seen = new Set<string>();

  const push = (card: HomeStory | undefined) => {
    if (!card || seen.has(card.id)) return;
    seen.add(card.id);
    cards.push(card);
  };

  const personal =
    role === 'adult_player'
      ? nextOf(men, nowIso)
      : role === 'coach' || (role === 'guardian' && hasChildren)
        ? nextOf(kids, nowIso)
        : undefined;
  if (personal) {
    push(upcomingStory(personal, role === 'adult_player' ? 'Next match' : 'Next session'));
  }

  const clubSoccer = nextOf([...men, ...plus], nowIso);
  if (clubSoccer && clubSoccer.id !== personal?.id) {
    push(upcomingStory(clubSoccer, 'Upcoming soccer'));
  }

  const cricketToday = cricket.find((item) => isSameWallDay(item.startsAt, posted));
  if (cricketToday) {
    const story = cricketTodayStory(cricketToday, nowIso);
    if (story) push(story);
    else if (eventPhase(cricketToday, nowIso) === 'upcoming' && cricketToday.id !== personal?.id && cricketToday.id !== clubSoccer?.id) {
      push(upcomingStory(cricketToday, 'Upcoming cricket'));
    }
  }

  if (!cards.length) {
    const anyNext = nextOf(schedule.filter((item) => item.status !== 'cancelled'), nowIso);
    if (anyNext) push(upcomingStory(anyNext, 'Upcoming'));
  }

  return cards.slice(0, 3);
}
