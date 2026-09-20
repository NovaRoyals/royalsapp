const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

function wallClock(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour: Number(match[4]),
      minute: Number(match[5]),
    };
  }
  const date = new Date(iso);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  };
}

export function formatEventParts(iso: string) {
  const clock = wallClock(iso);
  const weekdayIndex = new Date(Date.UTC(clock.year, clock.month - 1, clock.day, 12, 0, 0)).getUTCDay();
  const hour12 = clock.hour % 12 || 12;
  const meridian = clock.hour >= 12 ? 'PM' : 'AM';
  return {
    day: String(clock.day),
    month: MONTHS[clock.month - 1],
    weekday: WEEKDAYS[weekdayIndex],
    time: `${hour12}:${String(clock.minute).padStart(2, '0')} ${meridian}`,
  };
}

export function formatEventWhen(iso: string) {
  const clock = wallClock(iso);
  const weekdayIndex = new Date(Date.UTC(clock.year, clock.month - 1, clock.day, 12, 0, 0)).getUTCDay();
  return `${WEEKDAYS_LONG[weekdayIndex]}, ${MONTHS_LONG[clock.month - 1]} ${clock.day} · ${formatEventParts(iso).time}`;
}

export function estimatedTravelStub(venue: string) {
  if (venue.toLowerCase().includes('nottoway')) return '18 min from Fairfax (stub · live maps off)';
  if (venue.toLowerCase().includes('arrowhead')) return '22 min from Fairfax (stub · live maps off)';
  if (venue.toLowerCase().includes('manassas') || venue.toLowerCase().includes('cricket')) return '38 min from Fairfax (stub · live maps off)';
  return '22 min from Fairfax (stub · live maps off)';
}

/** Instant used for past/future math. */
export function clubNowIso(now = new Date()) {
  return now.toISOString();
}

/** Posted Northern Virginia wall time, used for today/tomorrow labels. */
export function clubNowPostedIso(now = new Date()) {
  const bag = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'longOffset',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const offsetMatch = String(bag.timeZoneName ?? '').match(/([+-]\d{2}:?\d{2})/);
  const offset = offsetMatch ? (offsetMatch[1].includes(':') ? offsetMatch[1] : `${offsetMatch[1].slice(0, 3)}:${offsetMatch[1].slice(3)}`) : '-04:00';
  return `${bag.year}-${bag.month}-${bag.day}T${bag.hour}:${bag.minute}:${bag.second}${offset}`;
}

export function offsetSuffix(iso: string) {
  const match = iso.match(/([+-]\d{2}:\d{2}|Z)$/);
  return match ? match[1] : '-04:00';
}

export function wallToIso(
  clock: { year: number; month: number; day: number; hour: number; minute: number },
  offset: string,
) {
  const pad = (value: number) => String(value).padStart(2, '0');
  const suffix = offset === 'Z' ? 'Z' : offset;
  return `${clock.year}-${pad(clock.month)}-${pad(clock.day)}T${pad(clock.hour)}:${pad(clock.minute)}:00${suffix}`;
}

export function addMinutesToWall(iso: string, minutes: number) {
  const clock = wallClock(iso);
  const utc = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute) + minutes * 60_000;
  const shifted = new Date(utc);
  return wallToIso(
    {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
    },
    offsetSuffix(iso),
  );
}

export function isSameWallDay(aIso: string, bIso: string) {
  const a = wallClock(aIso);
  const b = wallClock(bIso);
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function isEventPast(startsAt: string, nowIso = clubNowIso()) {
  return new Date(startsAt).getTime() <= new Date(nowIso).getTime();
}

export function relativeDayLabel(startsAt: string, nowPostedIso = clubNowPostedIso()) {
  if (isSameWallDay(startsAt, nowPostedIso)) return 'today';
  const tomorrow = addMinutesToWall(nowPostedIso, 24 * 60);
  if (isSameWallDay(startsAt, tomorrow)) return 'tomorrow';
  const parts = formatEventParts(startsAt);
  return `${parts.month} ${parts.day}`;
}

export function formatTimeFromIso(iso: string) {
  return formatEventParts(iso).time;
}

/**
 * Leave time in the event’s posted timezone.
 * Returns null when the event is past or the computed departure is not before kickoff.
 */
export function formatLeaveBy(startsAt: string, travelPlusBufferMin: number, nowIso = clubNowIso()) {
  if (travelPlusBufferMin <= 0 || isEventPast(startsAt, nowIso)) return null;
  const leaveIso = addMinutesToWall(startsAt, -travelPlusBufferMin);
  if (new Date(leaveIso).getTime() >= new Date(startsAt).getTime()) return null;
  return `Leave by ${formatTimeFromIso(leaveIso)}`;
}
