import type { CalendarStatus, PitchDay, PitchDayResult } from '@/services/fields';

export const PITCH_TIMES = ['9:00AM', '12:00PM', '4:00PM', '6:30PM', '8:00PM'] as const;
export const DEFAULT_PITCH_TIME = '6:30PM';

export const PITCH_TIME_MINUTES: Record<(typeof PITCH_TIMES)[number], number> = {
  '9:00AM': 540,
  '12:00PM': 720,
  '4:00PM': 960,
  '6:30PM': 1110,
  '8:00PM': 1200,
};

export const PITCH_DISCLAIMER =
  'Public league calendars only — private teams and game bookings aren’t checked. Treat this as a starting point, not a hold on the pitch.';

export const PITCH_MAP_HINT = 'Tap a glowing pin to preview the pitch — green is clear at your time, orange has something on.';

export function minutesForTime(time: string) {
  return PITCH_TIME_MINUTES[time as (typeof PITCH_TIMES)[number]] ?? 1110;
}

export function clubDateFromPosted(postedIso: string) {
  return postedIso.slice(0, 10);
}

export function formatDateChip(ymd: string, todayYmd: string) {
  if (ymd === todayYmd) return 'Today';
  const [year, month, day] = ymd.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${names[weekday]} ${day}`;
}

export function formatTimeChip(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return value;
  return `${Number(match[1])}:${match[2]} ${match[3].toUpperCase()}`;
}

export function formatUpdatedAgo(iso?: string, fromCache = false, now = Date.now()) {
  if (!iso) return fromCache ? 'Showing a saved copy' : 'Checking calendars';
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  const age =
    minutes < 1
      ? 'Updated just now'
      : minutes < 60
        ? `Updated ${minutes} min ago`
        : minutes < 60 * 24
          ? `Updated ${Math.round(minutes / 60)}h ago`
          : `Updated ${Math.round(minutes / 60 / 24)}d ago`;
  return fromCache ? `${age} · saved copy` : age;
}

export function isUpdatedStale(iso?: string, now = Date.now()) {
  if (!iso) return false;
  return now - new Date(iso).getTime() > 24 * 60 * 60_000;
}

export function statusCopy(status: CalendarStatus) {
  if (status === 'conflict') return 'On the public calendar';
  return 'No conflicts found';
}

export function conflictHeadline(pitch: PitchDay, time: string) {
  const count = pitch.overlappingEvents.length;
  if (count > 1) return `${count} conflicting events`;
  const first = pitch.overlappingEvents[0];
  if (first) return `Conflict at ${first.time}`;
  return `Conflict at ${formatTimeChip(time)}`;
}

export function pitchLabel(pitch: { name: string; pitch: string }) {
  return `${pitch.name} · ${pitch.pitch}`;
}

export type PitchSort = 'suggestion' | 'clear' | 'name';

export function sortPitches(pitches: PitchDay[], suggestionId: string | undefined, sort: PitchSort) {
  const copy = [...pitches];
  copy.sort((a, b) => {
    if (sort === 'suggestion' && suggestionId) {
      if (a.id === suggestionId) return -1;
      if (b.id === suggestionId) return 1;
    }
    if (sort === 'clear' || sort === 'suggestion') {
      if (a.status !== b.status) return a.status === 'no_conflict' ? -1 : 1;
    }
    const park = a.name.localeCompare(b.name);
    if (park) return park;
    return a.pitch.localeCompare(b.pitch);
  });
  return copy;
}

export function clearCount(day: PitchDayResult | undefined) {
  return day?.pitches.filter((item) => item.status === 'no_conflict').length ?? 0;
}
