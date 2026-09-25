import { kidsU8Roster } from '@/data/demo';
import { venueById, venueTitle } from '@/data/venues';
import { COACH_TEAM_ID } from '@/lib/membership';
import type {
  AttendanceStatus,
  AuditRecord,
  EventChange,
  FieldStatus,
  ParticipantRsvp,
  Person,
  Registration,
  ScheduleEvent,
  UserRole,
  VenueStatusUpdate,
} from '@/types/domain';

export const MANAGER_TEAM_ID = COACH_TEAM_ID;

export type ScheduleScope = 'mine' | 'club';
export type ClubLane = 'all' | 'kids' | 'open' | 'plus35' | 'women' | 'cricket' | 'tournament' | 'community';

const RSVP_LABEL: Record<AttendanceStatus, string> = {
  going: 'Going',
  not_going: 'Can’t make it',
  maybe: 'Not sure',
};

export function rsvpLabel(status?: AttendanceStatus) {
  if (!status) return 'No response';
  return RSVP_LABEL[status];
}

export function fieldStatusTone(status: FieldStatus = 'open'): 'success' | 'warning' | 'danger' | 'orange' | 'neutral' {
  if (status === 'open') return 'success';
  if (status === 'closed') return 'danger';
  if (status === 'relocated' || status === 'delayed' || status === 'inspection_pending') return 'orange';
  return 'neutral';
}

export function isAssignedStaff(role: UserRole, teamId?: string) {
  if (role === 'admin') return true;
  if (!teamId) return false;
  if (role === 'coach' || role === 'competition_manager') return teamId === MANAGER_TEAM_ID;
  return false;
}

export function canPublishOperations(role: UserRole) {
  return role === 'admin';
}

export function canRequestOperationalChange(role: UserRole, teamId?: string) {
  if (role === 'admin') return false;
  return isAssignedStaff(role, teamId);
}

export function canEditEventInstructions(role: UserRole, teamId?: string) {
  return role === 'admin' || isAssignedStaff(role, teamId);
}

export function canViewPrivateRoster(role: UserRole, teamId?: string) {
  return isAssignedStaff(role, teamId);
}

export function canRemindNonResponders(role: UserRole, teamId?: string) {
  return role === 'coach' || (role === 'admin' && Boolean(teamId));
}

/** Parents and players only. Staff roles never inherit this from a client-side role claim. */
export function canRsvpForPerson(role: UserRole, personId: string, children: Person[]) {
  if (role === 'guardian') return children.some((child) => child.id === personId);
  return false;
}

export function eventChildren<T extends { id: string; firstName: string }>(event: ScheduleEvent, children: T[]) {
  const ids = new Set(event.participantIds ?? []);
  return children.filter((child) => ids.has(child.id));
}

export function rsvpFor(event: ScheduleEvent, personId: string) {
  return event.participantRsvps?.find((item) => item.personId === personId)?.status;
}

export function rosterForEvent(event: ScheduleEvent): Person[] {
  if (event.teamId === COACH_TEAM_ID) return kidsU8Roster;
  return [];
}

export type RsvpBucket = 'going' | 'not_going' | 'maybe' | 'waiting';

export function rsvpBucket(status?: AttendanceStatus): RsvpBucket {
  if (status === 'going' || status === 'not_going' || status === 'maybe') return status;
  return 'waiting';
}

export function rsvpSummary(event: ScheduleEvent, roster: Person[]) {
  const counts = { going: 0, not_going: 0, maybe: 0, waiting: 0 };
  for (const person of roster) counts[rsvpBucket(rsvpFor(event, person.id))] += 1;
  return { total: roster.length, ...counts };
}

export function summaryLine(summary: ReturnType<typeof rsvpSummary>) {
  return `${summary.going} going · ${summary.not_going} unavailable · ${summary.maybe} unsure · ${summary.waiting} waiting`;
}

export function peopleInBucket(event: ScheduleEvent, roster: Person[], bucket: RsvpBucket | 'all') {
  if (bucket === 'all') return roster;
  return roster.filter((person) => rsvpBucket(rsvpFor(event, person.id)) === bucket);
}

export function nonResponders(event: ScheduleEvent, roster: Person[]) {
  return peopleInBucket(event, roster, 'waiting');
}

export function programLane(event: ScheduleEvent): Exclude<ClubLane, 'all'> {
  if (event.type === 'tournament_match') return 'tournament';
  if (event.type === 'club_event') return 'community';
  if (event.sport === 'cricket') return 'cricket';
  if (event.teamId === 'nova-royals-women' || event.programId === 'womens-soccer') return 'women';
  if (event.teamId === 'nova-royals-35plus' || event.programId === 'veterans-soccer') return 'plus35';
  if (event.teamId === 'nova-royals-men') return 'open';
  return 'kids';
}

export function laneLabel(lane: Exclude<ClubLane, 'all'>) {
  const labels = {
    kids: 'Kids Soccer',
    open: 'Open Soccer',
    plus35: '35+ Soccer',
    women: 'Women’s Soccer',
    cricket: 'ROYALS Cricket',
    tournament: 'Tournament',
    community: 'Community',
  } as const;
  return labels[lane];
}

export function eventTypeLabel(event: ScheduleEvent) {
  if (event.type === 'training') return event.sport === 'cricket' ? 'Training' : 'Training';
  if (event.type === 'tournament_match') return 'Tournament';
  if (event.type === 'club_event') return 'Community';
  if (event.sport === 'cricket') return 'Cricket match';
  if (event.type === 'league_match') return 'Match';
  if (event.type === 'friendly') return 'Friendly';
  return 'Event';
}

export function involvesUser(
  event: ScheduleEvent,
  role: UserRole,
  childIds: string[],
  registrations: Registration[],
) {
  if (event.supporterGoing && role !== 'guest') return true;
  if (role === 'guest' || role === 'volunteer') return false;
  if (role === 'coach') return event.teamId === COACH_TEAM_ID;
  if (role === 'competition_manager') return event.teamId === MANAGER_TEAM_ID;
  if (role === 'admin') return false;
  if (role === 'adult_player') return event.teamId === 'nova-royals-men';
  if (role === 'guardian') {
    if (event.participantIds?.some((id) => childIds.includes(id))) return true;
    if (event.participantIds?.length || event.type === 'tournament_match' || event.type === 'club_event') return false;
    return registrations.some(
      (item) =>
        (event.programId && item.programId === event.programId && item.participantIds.some((id) => childIds.includes(id))) ||
        (event.teamId && item.teamId === event.teamId && item.participantIds.some((id) => childIds.includes(id))),
    );
  }
  return false;
}

export function childNamesOnEvent(event: ScheduleEvent, children: { id: string; firstName: string }[]) {
  return eventChildren(event, children).map((child) => child.firstName);
}

export function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export function rangesOverlap(aStart: string, aEnd: string | undefined, bStart: string, bEnd: string | undefined) {
  const startA = new Date(aStart).getTime();
  const endA = new Date(aEnd ?? aStart).getTime();
  const startB = new Date(bStart).getTime();
  const endB = new Date(bEnd ?? bStart).getTime();
  return startA < endB && startB < endA;
}

export function overlapMinutes(aStart: string, aEnd: string | undefined, bStart: string, bEnd: string | undefined) {
  const start = Math.max(new Date(aStart).getTime(), new Date(bStart).getTime());
  const end = Math.min(new Date(aEnd ?? aStart).getTime(), new Date(bEnd ?? bStart).getTime());
  return Math.max(0, Math.round((end - start) / 60000));
}

export interface HouseholdConflict {
  a: ScheduleEvent;
  b: ScheduleEvent;
  minutes: number;
  names: string[];
}

export function householdConflicts(events: ScheduleEvent[], children: { id: string; firstName: string }[]): HouseholdConflict[] {
  const mine = events.filter((event) => eventChildren(event, children).length > 0 && event.status !== 'cancelled');
  const found: HouseholdConflict[] = [];
  for (let i = 0; i < mine.length; i += 1) {
    for (let j = i + 1; j < mine.length; j += 1) {
      const minutes = overlapMinutes(mine[i].startsAt, mine[i].endsAt, mine[j].startsAt, mine[j].endsAt);
      if (minutes <= 0) continue;
      const names = [...new Set([...childNamesOnEvent(mine[i], children), ...childNamesOnEvent(mine[j], children)])];
      found.push({ a: mine[i], b: mine[j], minutes, names });
    }
  }
  return found;
}

export function isUrgentEvent(event: ScheduleEvent) {
  if (event.fieldStatus === 'closed' || event.status === 'cancelled') return true;
  if (event.fieldStatus === 'relocated' || event.previousVenue) return true;
  if (event.pendingChange?.approval === 'requested') return true;
  return false;
}

export function needsAttentionCopy(event: ScheduleEvent) {
  if (event.fieldStatus === 'closed') {
    const reason = event.changes?.find((item) => item.kind === 'closure')?.reason;
    return reason ? `${event.previousVenue ?? event.venue} is closed. ${reason}` : `${event.venue} is closed.`;
  }
  if (event.status === 'cancelled') {
    return event.cancellationReason ? `Cancelled. ${event.cancellationReason}` : 'Cancelled.';
  }
  if (event.previousVenue) return `Moved from ${event.previousVenue}`;
  if (event.pendingChange?.approval === 'requested') return `${event.pendingChange.kind} requested · waiting for a club admin`;
  return 'Updated';
}

export function deadlineCopy(event: ScheduleEvent, waiting: number, now = new Date()) {
  const parts: string[] = [];
  if (event.rsvpDeadline) {
    const deadline = new Date(event.rsvpDeadline);
    const ms = deadline.getTime() - now.getTime();
    const days = Math.ceil(ms / 86_400_000);
    const weekday = deadline.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' });
    if (ms <= 0) parts.push('RSVP is closed');
    else if (days <= 1) parts.push('RSVP closes in 1 day');
    else if (days <= 3) parts.push(`RSVP closes in ${days} days`);
    else parts.push(`Response requested by ${weekday}`);
  }
  if (waiting > 0 && waiting <= 8) parts.push(`Coach is waiting for ${waiting} response${waiting === 1 ? '' : 's'}`);
  return parts;
}

export function withRsvp(event: ScheduleEvent, person: Person, status: AttendanceStatus, at: string): ScheduleEvent {
  const others = (event.participantRsvps ?? []).filter((item) => item.personId !== person.id);
  const next: ParticipantRsvp = { personId: person.id, personName: person.firstName, status, updatedAt: at };
  return { ...event, participantRsvps: [...others, next] };
}

export function placeLabel(event: ScheduleEvent) {
  const place = venueById(event.venueId);
  if (place) return venueTitle(place);
  return event.venue;
}

export function auditEntry(partial: Omit<AuditRecord, 'id' | 'at'> & { at?: string }): AuditRecord {
  return { ...partial, id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, at: partial.at ?? new Date().toISOString() };
}

export function changeEntry(partial: Omit<EventChange, 'id' | 'createdAt' | 'notificationStatus'> & { createdAt?: string }): EventChange {
  return {
    ...partial,
    id: `change-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    createdAt: partial.createdAt ?? new Date().toISOString(),
    notificationStatus: 'queued',
  };
}

export function venueUpdate(partial: Omit<VenueStatusUpdate, 'id' | 'updatedAt'> & { updatedAt?: string }): VenueStatusUpdate {
  return {
    ...partial,
    id: `venue-status-${Date.now()}`,
    updatedAt: partial.updatedAt ?? new Date().toISOString(),
  };
}

export function latestVenueUpdate(updates: VenueStatusUpdate[], venueId: string) {
  return updates.filter((item) => item.venueId === venueId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export function pushUnique<T extends { dedupeKey?: string; read: boolean }>(items: T[], next: T) {
  if (next.dedupeKey && items.some((item) => item.dedupeKey === next.dedupeKey && !item.read)) return items;
  return [next, ...items];
}
