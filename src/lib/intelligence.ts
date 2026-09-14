import type { Person, ScheduleEvent, UserRole } from '@/types/domain';
import { estimatedTravelStub, formatEventParts } from '@/lib/datetime';
import { fieldStatusLabel, weatherForEvent } from '@/services/weather';

/** Demo “now” so Game-Day Home can be reviewed without waiting for kickoff. */
export const DEMO_CLOCK_ISO = '2026-09-13T14:30:00-04:00';

export function travelMinutesStub(venue: string) {
  if (venue.toLowerCase().includes('nottoway') || venue.toLowerCase().includes('training')) return 18;
  if (venue.toLowerCase().includes('lawrence')) return 24;
  if (venue.toLowerCase().includes('cricket')) return 32;
  return 22;
}

export function leaveByIso(startsAt: string, venue: string, bufferMin = 10) {
  const start = new Date(startsAt).getTime();
  const leave = start - (travelMinutesStub(venue) + bufferMin) * 60_000;
  return new Date(leave).toISOString();
}

export function ageOnDate(dateOfBirth: string, asOfIso = '2026-09-13') {
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

export function householdConflictStub(role: UserRole) {
  if (role !== 'guardian') return null;
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

export function minutesUntil(startsAt: string, nowIso = DEMO_CLOCK_ISO) {
  return Math.round((new Date(startsAt).getTime() - new Date(nowIso).getTime()) / 60000);
}

export function isGameDayWindow(event: ScheduleEvent | undefined, nowIso = DEMO_CLOCK_ISO) {
  if (!event || event.status !== 'scheduled') return false;
  const mins = minutesUntil(event.startsAt, nowIso);
  return mins > 0 && mins <= 120;
}

export function gameDayBrief(event: ScheduleEvent, childName?: string, nowIso = DEMO_CLOCK_ISO) {
  const parts = formatEventParts(event.startsAt);
  const leave = formatEventParts(leaveByIso(event.startsAt, event.venue));
  const weather = weatherForEvent(event);
  const mins = travelMinutesStub(event.venue);
  return {
    headline: childName ? `${childName}’s practice begins at ${parts.time}` : `${event.title} · ${parts.time}`,
    drive: `${mins}-minute drive · ${estimatedTravelStub(event.venue)}`,
    leaveBy: `Leave by ${leave.time}`,
    field: `Field ${fieldStatusLabel(event.fieldStatus)}`,
    weather: weather.summary.includes('°') ? weather.summary : `${weather.summary} · 74°F stub`,
    bring: event.whatToBring ?? 'Check your session card',
    minutesOut: minutesUntil(event.startsAt, nowIso),
  };
}

export function crossClubSuggestion(_role: UserRole, followedIds: string[], schedule: ScheduleEvent[], nowIso = DEMO_CLOCK_ISO) {
  const upcoming = schedule.filter((item) => item.status === 'scheduled' && minutesUntil(item.startsAt, nowIso) > 0);
  const cricketThisWeekend = upcoming.find((item) => item.sport === 'cricket' && minutesUntil(item.startsAt, nowIso) < 36 * 60);
  const weekendOther = upcoming.find(
    (item) => item.sport !== 'cricket' && item.teamId !== 'nova-royals-kids-u8' && minutesUntil(item.startsAt, nowIso) < 36 * 60,
  );
  if (followedIds.includes('nova-royals-cricket') && !cricketThisWeekend && weekendOther) {
    return {
      title: 'No cricket fixture this weekend.',
      detail: `${weekendOther.title} · ${formatEventParts(weekendOther.startsAt).weekday} ${formatEventParts(weekendOther.startsAt).time}. ${weekendOther.supporterCount ?? 0} Royals are supporting.`,
      href: `/event/${weekendOther.id}`,
    };
  }
  return null;
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
