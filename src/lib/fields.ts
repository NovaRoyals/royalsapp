import type { CalendarStatus, PitchDay, PitchDayResult } from '@/services/fields';

function clockLabel(totalMinutes: number) {
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')}${period}`;
}

function buildPitchTimes(startMinutes: number, endMinutes: number, step: number) {
  const times: string[] = [];
  for (let minutes = startMinutes; minutes <= endMinutes; minutes += step) {
    times.push(clockLabel(minutes));
  }
  return times;
}

export const PITCH_TIMES = buildPitchTimes(7 * 60, 23 * 60, 30);
export const DEFAULT_PITCH_TIME = '6:30PM';

export const PITCH_DISCLAIMER =
  'Public league calendars only — private teams and game bookings aren’t checked. Treat this as a starting point, not a hold on the pitch.';

export const PITCH_FILTER_HINT = 'Green is clear at your time · Orange has something on · Map starts on the best pick';

export function minutesForTime(time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 1110;
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hours += 12;
  return hours * 60 + Number(match[2]);
}

export function clubDateFromPosted(postedIso: string) {
  return postedIso.slice(0, 10);
}

export function formatDateMenu(ymd: string, todayYmd: string) {
  if (ymd === todayYmd) return 'Today';
  const [ty, tm, td] = todayYmd.split('-').map(Number);
  const tmrw = new Date(Date.UTC(ty, tm - 1, td + 1)).toISOString().slice(0, 10);
  if (ymd === tmrw) return 'Tmrw';
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
      ? 'Just now'
      : minutes < 60
        ? `${minutes} min ago`
        : minutes < 60 * 24
          ? `${Math.round(minutes / 60)}h ago`
          : `${Math.round(minutes / 60 / 24)}d ago`;
  if (fromCache) return `${age} · saved`;
  return minutes < 1 ? 'Updated just now' : `Updated ${age}`;
}

export function isUpdatedStale(iso?: string, now = Date.now()) {
  if (!iso) return false;
  return now - new Date(iso).getTime() > 24 * 60 * 60_000;
}

export function statusCopy(status: CalendarStatus) {
  if (status === 'conflict') return 'On the public calendar';
  return 'No conflicts found';
}

export function collapsedStatus(pitch: PitchDay, time: string) {
  const label = formatTimeChip(time);
  if (pitch.status === 'conflict') {
    const count = Math.max(1, pitch.overlappingEvents.length);
    return `${count} conflicting events · ${label}`;
  }
  return `No conflicts found · ${label}`;
}

export function atTimeStatus(pitch: PitchDay) {
  if (pitch.status === 'conflict') {
    const count = Math.max(1, pitch.overlappingEvents.length);
    return count === 1 ? '1 event' : `${count} events`;
  }
  return 'No conflicts';
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

/** Short mark beside the park name: "1A turf", not "Turf Field 1A · TURF". */
export function compactPitchMark(pitch: { pitch: string; surface: string }) {
  const body = pitch.pitch
    .replace(/turf\s*field/gi, ' ')
    .replace(/\bfields?\b/gi, ' ')
    .replace(/\bturf\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!body) return pitch.surface.toLowerCase();
  return `${body} ${pitch.surface.toLowerCase()}`;
}

function parsePitchCode(label: string) {
  const match = label.match(/(\d+)\s*([A-Za-z])?\s*$/);
  if (!match) return null;
  return { n: Number(match[1]), letter: (match[2] ?? '').toUpperCase() };
}

/** Drop full-field duplicates of 8v8 splits, and extra C+ overlays of the same turf. */
export function collapseSplitPitches(pitches: PitchDay[]) {
  const groups = new Map<string, PitchDay[]>();
  for (const pitch of pitches) {
    const list = groups.get(pitch.name) ?? [];
    list.push(pitch);
    groups.set(pitch.name, list);
  }

  const next: PitchDay[] = [];
  for (const list of groups.values()) {
    const letters = new Map<number, Set<string>>();
    for (const pitch of list) {
      const code = parsePitchCode(pitch.pitch);
      if (!code?.letter) continue;
      const set = letters.get(code.n) ?? new Set<string>();
      set.add(code.letter);
      letters.set(code.n, set);
    }

    for (const pitch of list) {
      const code = parsePitchCode(pitch.pitch);
      if (!code) {
        next.push(pitch);
        continue;
      }
      const kids = letters.get(code.n);
      if (!code.letter && kids?.size) continue;
      if (code.letter > 'B' && kids?.has('A') && kids.has('B')) continue;
      next.push(pitch);
    }
  }
  return next;
}

export function resolveSuggestionId(pitches: PitchDay[], suggestionId?: string) {
  if (suggestionId && pitches.some((item) => item.id === suggestionId)) return suggestionId;
  if (suggestionId) {
    const kids = pitches.filter((item) => item.id.startsWith(suggestionId));
    const clear = kids.find((item) => item.status === 'no_conflict');
    if (clear) return clear.id;
    if (kids[0]) return kids[0].id;
  }
  return pitches.find((item) => item.status === 'no_conflict')?.id;
}

const PITCH_VENUE_ORDER = [
  'chantilly high',
  'greenbriar',
  'poplar tree',
  'lawrence',
  'westfield',
  'arrowhead',
  'centreville',
  'oakton high',
  'sully',
  'stringfellow',
  'oakmont',
  'oak marr',
  'arrowbrook',
  'lake fairfax',
  'nottoway',
  'cunningham',
  'freedom',
  'byrne',
  'hanson',
  'champe',
  'braddock',
];

function venueRank(name: string) {
  const hay = name.toLowerCase();
  const index = PITCH_VENUE_ORDER.findIndex((key) => hay.includes(key));
  return index === -1 ? PITCH_VENUE_ORDER.length : index;
}

export function sortPitches(pitches: PitchDay[]) {
  const copy = [...pitches];
  copy.sort((a, b) => {
    const venue = venueRank(a.name) - venueRank(b.name);
    if (venue) return venue;
    const park = a.name.localeCompare(b.name);
    if (park) return park;
    return a.pitch.localeCompare(b.pitch, undefined, { numeric: true });
  });
  return copy;
}

export function clearCount(day: PitchDayResult | undefined) {
  return day?.pitches.filter((item) => item.status === 'no_conflict').length ?? 0;
}
