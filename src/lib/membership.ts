import type { Registration, ScheduleEvent, UserRole } from '@/types/domain';

export const COACH_TEAM_ID = 'nova-royals-kids-u8';
export const PLAYER_TEAM_ID = 'nova-royals-men';

export function isTeamParticipant(role: UserRole, event: ScheduleEvent, registrations: Registration[]) {
  if (role === 'guest' || role === 'volunteer') return false;
  if (role === 'admin') return false;
  if (role === 'coach') return event.teamId === COACH_TEAM_ID || event.programId === 'fall-kids-2026';
  if (role === 'adult_player') return event.teamId === PLAYER_TEAM_ID;
  if (role === 'guardian') {
    return registrations.some(
      (item) =>
        (event.programId && item.programId === event.programId) || (event.teamId && item.teamId === event.teamId),
    );
  }
  return false;
}

export function canOpenSeasonHub(role: UserRole, hasRegistration: boolean) {
  return hasRegistration && (role === 'guardian' || role === 'admin');
}

export function canSeeFullRoster(role: UserRole, teamId?: string) {
  if (!teamId || role === 'guest' || role === 'volunteer') return false;
  if (role === 'admin') return true;
  if (role === 'coach') return teamId === COACH_TEAM_ID;
  if (role === 'adult_player') return teamId === PLAYER_TEAM_ID;
  if (role === 'guardian') return teamId === COACH_TEAM_ID;
  return false;
}

export function canPlayerRsvp(role: UserRole, event: ScheduleEvent, registrations: Registration[]) {
  if (role === 'coach' || role === 'admin' || role === 'volunteer' || role === 'guest') return false;
  return isTeamParticipant(role, event, registrations);
}

export function notificationsForRole<T extends { type: string; title: string; body: string; childId?: string; urgency?: string }>(
  role: UserRole,
  items: T[],
  childIds: string[] = ['child-maya'],
) {
  return items.filter((item) => {
    const only = (item as { forRole?: UserRole }).forRole;
    if (only && only !== role) return false;
    if (item.type === 'message' && !only) return false;
    if (item.childId && role === 'guardian' && !childIds.includes(item.childId)) return false;
    if (item.childId && (role === 'guest' || role === 'adult_player' || role === 'volunteer')) return false;
    if (role === 'guest' || role === 'volunteer') {
      return item.type === 'announcement' || item.type === 'weather' || item.type === 'field' || item.urgency === 'urgent';
    }
    if (item.type === 'coach_reminder') return role === 'coach' || role === 'admin';
    if (item.type === 'coach_update') {
      if (role === 'admin') return true;
      if (role !== 'guardian') return false;
      if (!item.childId) return true;
      return childIds.includes(item.childId);
    }
    if (role === 'adult_player') return item.type !== 'registration' && !/Maya/i.test(`${item.title} ${item.body}`);
    if (role === 'coach') return item.type !== 'registration';
    return true;
  });
}
