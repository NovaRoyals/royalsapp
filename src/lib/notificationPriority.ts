import type { AppNotification, NotificationPrefs, UserRole } from '../types/domain';

/**
 * Three tiers of alert, so the ones that matter cannot be lost among the ones that do not.
 *
 *   critical   a cancellation, a field closure, anything about safety. Always delivered. There is
 *              no setting that turns it off.
 *   important  coach messages, schedule changes, weather heads-ups. Follows "team alerts".
 *   normal     club news, reminders, registration updates. Follows "club news".
 *
 * Muting is allowed for the last two. Muting never hides an alert in the app; it only stops it
 * from being pushed to the phone.
 */

export type Category = 'critical' | 'important' | 'normal';

export function categoryOf(item: Pick<AppNotification, 'type' | 'urgency' | 'category'>): Category {
  if (item.category) return item.category;
  if (item.urgency === 'urgent') return 'critical';
  if (item.type === 'field') return 'critical';
  if (item.type === 'message' || item.type === 'coach_update' || item.type === 'weather' || item.type === 'change' || item.urgency === 'high') return 'important';
  return 'normal';
}

/** Whether this alert should be pushed to the phone, given what the person has chosen. */
export function shouldPush(item: Pick<AppNotification, 'type' | 'urgency' | 'category'>, prefs: NotificationPrefs) {
  const category = categoryOf(item);
  if (category === 'critical') return true;
  if (category === 'important') return prefs.team;
  return prefs.community;
}

export function partitionByPriority<T extends Pick<AppNotification, 'type' | 'urgency' | 'category' | 'read' | 'createdAt'>>(items: T[], now = new Date()) {
  const week = 7 * 86_400_000;
  const critical: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    const recent = now.getTime() - new Date(item.createdAt).getTime() <= week;
    if (categoryOf(item) === 'critical' && (!item.read || recent)) critical.push(item);
    else rest.push(item);
  }
  return { critical, rest };
}

/** Which alerts a person gets by role and team. Announcement alerts carry both. */
export function addressedTo(item: Pick<AppNotification, 'roles' | 'teamIds'>, role: UserRole, teamIds: string[]) {
  if (role === 'admin') return true;
  if (item.roles && !item.roles.includes(role)) return false;
  if (item.teamIds && item.teamIds.length > 0) return item.teamIds.some((id) => teamIds.includes(id));
  return true;
}
