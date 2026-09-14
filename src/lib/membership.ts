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

export function canPlayerRsvp(role: UserRole, event: ScheduleEvent, registrations: Registration[]) {
  if (role === 'coach' || role === 'admin' || role === 'volunteer' || role === 'guest') return false;
  return isTeamParticipant(role, event, registrations);
}

export function notificationsForRole<T extends { type: string; title: string; body: string }>(role: UserRole, items: T[]) {
  return items.filter((item) => {
    if (role === 'guest' || role === 'volunteer') return item.type === 'announcement' || item.type === 'weather';
    if (role === 'adult_player') return item.type !== 'registration' && !/Maya/i.test(`${item.title} ${item.body}`);
    if (role === 'coach') return item.type !== 'registration';
    return true;
  });
}
