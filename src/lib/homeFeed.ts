import { clubNowPostedIso, eventPhase, formatEventParts } from './datetime';
import type { Person, Program, Registration, RegistrationStatus, ScheduleEvent, UserRole } from '../types/domain';

function youthEligible(dateOfBirth: string) {
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  const asOf = clubNowPostedIso().slice(0, 10);
  const [asYear, asMonth, asDay] = asOf.split('-').map(Number);
  let age = asYear - year;
  if (asMonth < month || (asMonth === month && asDay < day)) age -= 1;
  return age >= 3 && age <= 16;
}

const ENROLLED: RegistrationStatus[] = ['submitted', 'pending', 'approved', 'waitlisted'];

export function enrolledRegistration(registrations: Registration[], childId: string, programId: string) {
  return registrations.find(
    (item) =>
      item.programId === programId &&
      item.participantIds.includes(childId) &&
      item.status !== 'cancelled' &&
      item.status !== 'rejected' &&
      (ENROLLED.includes(item.status) || item.status === 'draft' || item.paymentStatus === 'pending'),
  );
}

/** Youth registration for For you. Guests see the open program. Signed-in households are named only when a child is known to be eligible and not already enrolled. */
export function youthRegistrationPrompt(
  role: UserRole,
  children: Person[],
  registrations: Registration[],
  programId: string,
): { programId: string; childName?: string } | null {
  if (role === 'guest') return { programId };
  if (role !== 'guardian') return null;
  for (const child of children) {
    if (!child.dateOfBirth || !youthEligible(child.dateOfBirth)) continue;
    if (registrations.some((item) => item.participantIds.includes(child.id) && item.status !== 'cancelled' && item.status !== 'rejected' && ENROLLED.includes(item.status))) {
      continue;
    }
    return { programId, childName: child.firstName };
  }
  return null;
}

/** Drop a supporting line that only repeats the headline. Keep lines that add a fact. */
export function conciseSupport(headline: string, supporting: string, opponent?: string) {
  const line = supporting.trim();
  if (!line || line === headline.trim()) return undefined;
  if (opponent && line.includes('final group match against')) return line;
  if (opponent && line.includes(`plays ${opponent}`)) return `vs ${opponent}`;
  return line;
}

export function programIsEnrolled(program: Program, registrations: Registration[]) {
  return registrations.some(
    (item) =>
      item.status !== 'cancelled' &&
      item.status !== 'rejected' &&
      ENROLLED.includes(item.status) &&
      (item.programId === program.id || (program.teamId && item.teamId === program.teamId)),
  );
}

export function programStatusLine(program: Program, schedule: ScheduleEvent[], nowIso: string, enrolled: boolean) {
  const related = schedule.filter((event) => event.programId === program.id || (program.teamId && event.teamId === program.teamId));
  const upcoming = related
    .filter((event) => event.status !== 'cancelled' && eventPhase(event, nowIso) === 'upcoming')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  if (program.registrationOpen && !enrolled && !upcoming) return 'Registration open';
  if (upcoming) {
    const parts = formatEventParts(upcoming.startsAt);
    const kind = upcoming.type === 'training' ? 'Next training' : 'Next match';
    return `${kind} · ${parts.weekday} ${parts.time}`;
  }
  if (program.registrationOpen && !enrolled) return 'Registration open';
  const recent = related
    .filter((event) => event.status === 'completed' && event.result?.trim())
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];
  if (recent?.result) return `Recent result · ${recent.result}`;
  if (/no match season/i.test(program.dates)) return 'No active match season';
  return program.dates;
}

const CLUB_TEAMS = ['nova-royals-men', 'nova-royals-35plus', 'nova-royals-cricket', 'nova-royals-women'];

/** Up to two upcoming club events that are not the primary Next up card. Prefer a different team than the primary event. */
export function aroundClubEvents(schedule: ScheduleEvent[], nowIso: string, excludeIds: string[], limit = 2) {
  const upcoming = schedule
    .filter((event) => event.status !== 'cancelled' && event.status !== 'completed' && !excludeIds.includes(event.id) && eventPhase(event, nowIso) === 'upcoming')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const excludedTeams = new Set(
    schedule.filter((event) => excludeIds.includes(event.id) && event.teamId).map((event) => event.teamId as string),
  );
  const picked: ScheduleEvent[] = [];
  const take = (match: (event: ScheduleEvent) => boolean) => {
    if (picked.length >= limit) return;
    const event = upcoming.find((item) => match(item) && !picked.some((chosen) => chosen.id === item.id));
    if (event) picked.push(event);
  };
  for (const teamId of CLUB_TEAMS) {
    if (excludedTeams.has(teamId)) continue;
    take((event) => event.teamId === teamId);
  }
  for (const teamId of CLUB_TEAMS) take((event) => event.teamId === teamId);
  return picked;
}

export function orderedPrograms(programs: Program[], registrations: Registration[]) {
  const connected = (program: Program) => programIsEnrolled(program, registrations);
  return [...programs].sort((a, b) => Number(connected(b)) - Number(connected(a)));
}
