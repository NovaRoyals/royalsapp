import type { Announcement, AnnouncementKind, AudienceGroup, NoticeUrgency, ScheduleEvent, UserRole } from '../types/domain';

/**
 * Announcements: what is sent, to whom, who may send it, and who sees it.
 *
 * Two audiences exist. The whole club (optionally narrowed to youth families, adult players or
 * supporters), or one or more teams. Coaches and managers can only write to their own teams;
 * only the club office writes to everyone. A cancellation is the most important thing the app
 * says, so it is its own kind: it names the sessions it cancels, and it can never be muted.
 */

export const KIDS_PROGRAM_ID = 'fall-kids-2026';

export const AUDIENCE_TEAMS: { id: string; label: string; youth: boolean }[] = [
  { id: 'nova-royals-kids-u8', label: 'Kids U8 · ages 7–8', youth: true },
  { id: 'nova-royals-kids-u6', label: 'Kids U6 · ages 5–6', youth: true },
  { id: 'nova-royals-women', label: 'Women’s Soccer', youth: false },
  { id: 'nova-royals-men', label: 'Men’s Open', youth: false },
  { id: 'nova-royals-35plus', label: 'Veterans 35+', youth: false },
  { id: 'nova-royals-cricket', label: 'ROYALS Cricket', youth: false },
];

export const GROUPS: { id: AudienceGroup; label: string; detail: string }[] = [
  { id: 'youth_families', label: 'Youth families', detail: 'Parents and guardians of kids' },
  { id: 'adult_players', label: 'Adult players', detail: 'Soccer and cricket players' },
  { id: 'supporters', label: 'Supporters and volunteers', detail: 'Everyone else following the club' },
];

/**
 * Coaches may cancel their own team's sessions directly. Set to false to make a coach's
 * cancellation need the club office first (it then goes through the request flow instead).
 */
export const COACH_MAY_CANCEL = true;

export const KINDS: Record<
  AnnouncementKind,
  { label: string; icon: 'megaphone-outline' | 'calendar-outline' | 'close-circle-outline' | 'rainy-outline' | 'alarm-outline'; tint: 'mint' | 'gold' | 'blush' | 'sky' | 'lilac'; blurb: string }
> = {
  update: { label: 'Update', icon: 'megaphone-outline', tint: 'mint', blurb: 'General news' },
  schedule: { label: 'Schedule change', icon: 'calendar-outline', tint: 'gold', blurb: 'New time or place' },
  cancellation: { label: 'Cancellation', icon: 'close-circle-outline', tint: 'blush', blurb: 'A session is off' },
  weather: { label: 'Weather heads-up', icon: 'rainy-outline', tint: 'sky', blurb: 'Weather may affect play' },
  reminder: { label: 'Reminder', icon: 'alarm-outline', tint: 'lilac', blurb: 'Bring, arrive, respond' },
};

export type Viewer = { role: UserRole; teamIds: string[] };

export function allowedTeamIds(role: UserRole): string[] {
  if (role === 'admin') return AUDIENCE_TEAMS.map((team) => team.id);
  if (role === 'coach') return ['nova-royals-kids-u8', 'nova-royals-kids-u6'];
  // The demo team manager runs the same U8 team the coach does.
  if (role === 'competition_manager') return ['nova-royals-kids-u8'];
  return [];
}

export const canSendAnnouncement = (role: UserRole) => allowedTeamIds(role).length > 0;
export const canGoClubWide = (role: UserRole) => role === 'admin';

export function canCancelTeam(role: UserRole, teamId?: string) {
  if (!teamId) return false;
  if (role === 'admin') return true;
  return COACH_MAY_CANCEL && (role === 'coach' || role === 'competition_manager') && allowedTeamIds(role).includes(teamId);
}

export const kindOf = (announcement: Pick<Announcement, 'kind'>): AnnouncementKind => announcement.kind ?? 'update';

export type Audience = { club: boolean; groups: AudienceGroup[]; teamIds: string[] };

/** Reads both new announcements and the older ones that only had a teamId or programId. */
export function audienceOf(announcement: Announcement): Audience {
  const every: AudienceGroup[] = ['youth_families', 'adult_players', 'supporters'];
  if (announcement.audience === 'club') return { club: true, groups: announcement.groups?.length ? announcement.groups : every, teamIds: [] };
  const fromProgram = announcement.audience === 'program' && announcement.programId === KIDS_PROGRAM_ID ? ['nova-royals-kids-u8', 'nova-royals-kids-u6'] : [];
  // Explicit teams win. Otherwise a program announcement reaches every team in the program, even if an old record also named one.
  const ids = announcement.teamIds?.length ? announcement.teamIds : [...new Set([...(announcement.teamId ? [announcement.teamId] : []), ...fromProgram])];
  return { club: false, groups: [], teamIds: ids };
}

const GROUP_OF_ROLE: Partial<Record<UserRole, AudienceGroup>> = {
  guardian: 'youth_families',
  adult_player: 'adult_players',
  guest: 'supporters',
  volunteer: 'supporters',
};

/** The teams someone belongs to, from what the app knows about them. */
export function viewerTeamIds(role: UserRole, registrationTeamIds: string[]): string[] {
  if (role === 'admin') return AUDIENCE_TEAMS.map((team) => team.id);
  if (role === 'coach' || role === 'competition_manager') return allowedTeamIds(role);
  if (role === 'adult_player') return ['nova-royals-men', ...registrationTeamIds];
  if (role === 'guardian') return registrationTeamIds;
  return [];
}

export function visibleTo(announcement: Announcement, viewer: Viewer) {
  if (viewer.role === 'admin') return true;
  const audience = audienceOf(announcement);
  if (audience.club) {
    if (viewer.role === 'coach' || viewer.role === 'competition_manager') return true;
    const group = GROUP_OF_ROLE[viewer.role];
    return group ? audience.groups.includes(group) : false;
  }
  return audience.teamIds.some((id) => viewer.teamIds.includes(id));
}

export function audienceLabel(announcement: Announcement) {
  const audience = audienceOf(announcement);
  if (audience.club) {
    if (audience.groups.length === 3) return 'Whole club';
    return `Club · ${audience.groups.map((group) => GROUPS.find((item) => item.id === group)?.label.toLowerCase()).join(', ')}`;
  }
  const names = audience.teamIds.map((id) => AUDIENCE_TEAMS.find((team) => team.id === id)?.label.split(' · ')[0] ?? id);
  return names.length ? names.join(' + ') : announcement.scopeLabel;
}

/** "17 families" style estimate for the preview, only where the count is known. */
export function recipientEstimate(draft: Pick<Draft, 'scope' | 'groups' | 'teamIds'>, counts: Record<string, number>) {
  if (draft.scope === 'club') {
    return draft.groups.length === 3 ? 'Everyone following the club' : draft.groups.map((group) => GROUPS.find((item) => item.id === group)?.label.toLowerCase()).join(' and ');
  }
  const known = draft.teamIds.filter((id) => counts[id] != null);
  const total = known.reduce((sum, id) => sum + counts[id], 0);
  const names = draft.teamIds.map((id) => AUDIENCE_TEAMS.find((team) => team.id === id)?.label.split(' · ')[0]).filter(Boolean);
  return known.length === draft.teamIds.length && total > 0 ? `${names.join(' + ')} · ${total} people` : names.join(' + ');
}

const DAY = 86_400_000;

/** Critical and pinned announcements stay in Latest longer; ordinary news ages into Past. */
export function isCurrent(announcement: Announcement, now = new Date()) {
  if (announcement.pinned) return true;
  const age = now.getTime() - new Date(announcement.publishedAt).getTime();
  const long = announcement.urgency === 'urgent' || announcement.urgency === 'high' || kindOf(announcement) === 'cancellation';
  return age <= (long ? 14 : 7) * DAY;
}

/** A recent cancellation or urgent notice outranks everything, including pinned news. */
const isLive = (announcement: Announcement, now: Date) =>
  (kindOf(announcement) === 'cancellation' || announcement.urgency === 'urgent') && now.getTime() - new Date(announcement.publishedAt).getTime() <= 3 * DAY;

export function splitAnnouncements(list: Announcement[], now = new Date()) {
  const rank = (item: Announcement) => (isLive(item, now) ? 0 : item.pinned ? 1 : 2);
  const sorted = [...list].sort((a, b) => rank(a) - rank(b) || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return { latest: sorted.filter((item) => isCurrent(item, now)), past: sorted.filter((item) => !isCurrent(item, now)) };
}

/** What Home leads with: a recent cancellation, weather heads-up or schedule change, if any. */
export function homeHeadline(list: Announcement[], viewer: Viewer, now = new Date()) {
  return list
    .filter((item) => visibleTo(item, viewer))
    .filter((item) => ['cancellation', 'weather', 'schedule'].includes(kindOf(item)) || item.urgency === 'urgent')
    .filter((item) => now.getTime() - new Date(item.publishedAt).getTime() <= 3 * DAY)
    .sort((a, b) => {
      const rank = (item: Announcement) => (kindOf(item) === 'cancellation' ? 0 : item.urgency === 'urgent' ? 1 : 2);
      return rank(a) - rank(b) || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    })[0];
}

// ---------------------------------------------------------------------------------------------
// Writing one
// ---------------------------------------------------------------------------------------------

export type Draft = {
  kind: AnnouncementKind;
  scope: 'club' | 'teams';
  groups: AudienceGroup[];
  teamIds: string[];
  /** Sessions a cancellation or schedule change is about. */
  eventIds: string[];
  reason: string;
  title: string;
  body: string;
  important: boolean;
};

export const emptyDraft = (role: UserRole): Draft => ({
  kind: 'update',
  scope: canGoClubWide(role) ? 'club' : 'teams',
  groups: ['youth_families', 'adult_players', 'supporters'],
  teamIds: canGoClubWide(role) ? [] : allowedTeamIds(role).slice(0, 1),
  eventIds: [],
  reason: '',
  title: '',
  body: '',
  important: false,
});

export const REASONS = ['Weather', 'Field closed', 'Coach unavailable', 'Low turnout', 'Other'];

export function urgencyFor(draft: Draft): NoticeUrgency {
  if (draft.kind === 'cancellation') return 'urgent';
  if (draft.kind === 'weather' || draft.kind === 'schedule' || draft.important) return 'high';
  return 'normal';
}

/** Starting words for each kind, so a coach in a hurry only has to check them. */
export function templateFor(kind: AnnouncementKind, input: { team?: string; session?: string; reason?: string; weather?: string }) {
  const team = input.team ?? 'your team';
  const session = input.session ?? 'the next session';
  const reason = input.reason && input.reason !== 'Other' ? input.reason.toLowerCase() : '';
  switch (kind) {
    case 'cancellation':
      return {
        title: `Cancelled: ${session}`,
        body: `${session} for ${team} is cancelled${reason ? ` because of ${reason === 'weather' ? 'the weather' : reason}` : ''}. We’ll share a make-up plan as soon as we have one. Thank you for understanding.`,
      };
    case 'weather':
      return {
        title: 'Weather heads-up',
        body: `${input.weather ?? 'The forecast is unsettled.'} We’ll make a call by ${'tomorrow morning'} and update everyone here. Until then, please plan to wait for our message before you head out.`,
      };
    case 'schedule':
      return { title: `Change: ${session}`, body: `There’s a change to ${session} for ${team}. New details: ` };
    case 'reminder':
      return { title: `Reminder: ${session}`, body: `A quick reminder for ${team}: ` };
    default:
      return { title: '', body: '' };
  }
}

export function validateDraft(draft: Draft, role: UserRole): string | null {
  if (!canSendAnnouncement(role)) return 'Only coaches, managers and the club office can send announcements.';
  if (draft.scope === 'club') {
    if (!canGoClubWide(role)) return 'Only the club office can write to the whole club. Pick your team instead.';
    if (draft.groups.length === 0) return 'Pick who should get it.';
  } else {
    if (draft.teamIds.length === 0) return 'Pick at least one team.';
    const allowed = allowedTeamIds(role);
    if (draft.teamIds.some((id) => !allowed.includes(id))) return 'You can only write to your own teams.';
  }
  if (draft.kind === 'cancellation') {
    if (draft.scope === 'club') return 'A cancellation has to name the team and session it cancels.';
    if (draft.eventIds.length === 0) return 'Pick the session that is cancelled.';
    if (!draft.reason) return 'Say why, so families know what to expect.';
    if (!COACH_MAY_CANCEL && role !== 'admin') return 'Cancellations go through the club office.';
  }
  if (!draft.title.trim()) return 'Add a short headline.';
  if (!draft.body.trim()) return 'Write the message.';
  if (draft.title.trim().length > 80) return 'Keep the headline under 80 characters.';
  if (draft.body.trim().length > 1200) return 'Keep the message under 1,200 characters.';
  return null;
}

export function toAnnouncement(draft: Draft, author: { name: string; role: UserRole }): Omit<Announcement, 'id' | 'publishedAt' | 'replies'> {
  const teams = draft.teamIds.map((id) => AUDIENCE_TEAMS.find((team) => team.id === id)?.label.split(' · ')[0] ?? id);
  return {
    title: draft.title.trim(),
    body: draft.body.trim(),
    audience: draft.scope === 'club' ? 'club' : 'team',
    scopeLabel: draft.scope === 'club' ? 'Nova Royals' : teams.join(' + '),
    kind: draft.kind,
    groups: draft.scope === 'club' ? draft.groups : undefined,
    teamIds: draft.scope === 'teams' ? draft.teamIds : undefined,
    teamId: draft.scope === 'teams' ? draft.teamIds[0] : undefined,
    eventIds: draft.eventIds.length ? draft.eventIds : undefined,
    urgency: urgencyFor(draft),
    authorName: author.name,
    authorRole: author.role,
  };
}

/** Upcoming, not-yet-cancelled sessions for the chosen teams, soonest first. */
export function upcomingSessions(schedule: ScheduleEvent[], teamIds: string[], now = new Date(), limit = 8) {
  return schedule
    .filter((event) => event.teamId && teamIds.includes(event.teamId) && event.status !== 'cancelled' && event.status !== 'completed')
    .filter((event) => new Date(event.startsAt).getTime() >= now.getTime() - 3 * 60 * 60_000)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, limit);
}
