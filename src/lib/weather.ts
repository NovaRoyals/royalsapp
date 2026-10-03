/**
 * Turning a forecast into something a parent or coach can act on.
 *
 * The forecast never decides anything. It can say "looks great" or "storms are possible around
 * the session", but cancelling is always a person's call: the coach or the club. When the
 * outlook is risky, families are told to wait for that call, and staff are offered a shortcut to
 * announce early. Nothing here invents a forecast: with no data there is no outlook.
 */

export type HourlyPoint = {
  /** Local club time, e.g. 2026-10-04T09:00 */
  time: string;
  tempF: number;
  precipProb: number;
  precipMm: number;
  windMph: number;
  gustMph: number;
  /** WMO weather code */
  code: number;
};

export type OutlookLevel = 'good' | 'watch' | 'risky';

export type Outlook = {
  level: OutlookLevel;
  /** "72°F · Clear" */
  summary: string;
  tempF: number;
  /** What a family reads. Calm, never says the session is off. */
  family: string;
  /** What staff read, with the numbers behind it. */
  staff: string;
  reasons: string[];
  icon: 'sunny-outline' | 'partly-sunny-outline' | 'cloud-outline' | 'rainy-outline' | 'thunderstorm-outline' | 'snow-outline' | 'warning-outline';
};

const THUNDER = new Set([95, 96, 99]);
const SNOW = new Set([71, 73, 75, 77, 85, 86]);
const FREEZING = new Set([56, 57, 66, 67]);
const HEAVY_RAIN = new Set([65, 82]);
const RAIN = new Set([51, 53, 55, 61, 63, 80, 81]);
const FOG = new Set([45, 48]);

export function describeCode(code: number): { label: string; icon: Outlook['icon'] } {
  if (THUNDER.has(code)) return { label: 'Thunderstorms', icon: 'thunderstorm-outline' };
  if (SNOW.has(code)) return { label: 'Snow', icon: 'snow-outline' };
  if (FREEZING.has(code)) return { label: 'Freezing rain', icon: 'snow-outline' };
  if (HEAVY_RAIN.has(code)) return { label: 'Heavy rain', icon: 'rainy-outline' };
  if (RAIN.has(code)) return { label: 'Rain', icon: 'rainy-outline' };
  if (FOG.has(code)) return { label: 'Fog', icon: 'cloud-outline' };
  if (code === 0) return { label: 'Clear', icon: 'sunny-outline' };
  if (code === 1 || code === 2) return { label: 'Partly cloudy', icon: 'partly-sunny-outline' };
  return { label: 'Cloudy', icon: 'cloud-outline' };
}

const wall = (iso: string) => new Date(`${iso.length === 16 ? `${iso}:00` : iso}`.replace(/Z$|[+-]\d\d:\d\d$/, '')).getTime();

/** The hours that overlap the session, plus the hour before people arrive. */
export function windowFor(hours: HourlyPoint[], startsAt: string, durationMin = 60) {
  const start = wall(startsAt.slice(0, 16));
  const from = start - 60 * 60_000;
  const to = start + durationMin * 60_000;
  return hours.filter((hour) => {
    const t = wall(hour.time);
    return t >= from - 59 * 60_000 && t <= to;
  });
}

const dayName = (startsAt: string) =>
  new Date(`${startsAt.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });

const clock = (startsAt: string) => {
  const [h, m] = startsAt.slice(11, 16).split(':').map(Number);
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

export function assessOutlook(hours: HourlyPoint[], startsAt: string, durationMin = 60): Outlook | null {
  const slice = windowFor(hours, startsAt, durationMin);
  if (slice.length === 0) return null;

  const probability = Math.max(...slice.map((hour) => hour.precipProb));
  const rain = slice.reduce((sum, hour) => sum + hour.precipMm, 0);
  const gust = Math.max(...slice.map((hour) => hour.gustMph));
  const hottest = Math.max(...slice.map((hour) => hour.tempF));
  const coldest = Math.min(...slice.map((hour) => hour.tempF));
  const codes = slice.map((hour) => hour.code);
  const startHour = slice.reduce((best, hour) => (Math.abs(wall(hour.time) - wall(startsAt.slice(0, 16))) < Math.abs(wall(best.time) - wall(startsAt.slice(0, 16))) ? hour : best), slice[0]);
  const worstCode = codes.find((code) => THUNDER.has(code)) ?? codes.find((code) => SNOW.has(code) || FREEZING.has(code)) ?? codes.find((code) => HEAVY_RAIN.has(code)) ?? codes.find((code) => RAIN.has(code)) ?? startHour.code;
  const condition = describeCode(worstCode);
  const tempF = Math.round(startHour.tempF);

  const reasons: string[] = [];
  let level = 'good' as OutlookLevel;
  const raise = (to: OutlookLevel) => {
    if (to === 'risky' || level === 'good') level = to;
  };

  if (codes.some((code) => THUNDER.has(code))) { raise('risky'); reasons.push('Thunderstorms in the forecast'); }
  if (codes.some((code) => SNOW.has(code) || FREEZING.has(code))) { raise('risky'); reasons.push('Snow or freezing rain'); }
  if (probability >= 60) { raise('risky'); reasons.push(`${probability}% chance of rain`); }
  else if (probability >= 30) { raise('watch'); reasons.push(`${probability}% chance of rain`); }
  if (rain >= 2.5) { raise('risky'); reasons.push(`${rain.toFixed(1)} mm of rain expected`); }
  else if (rain >= 0.5) { raise('watch'); reasons.push(`${rain.toFixed(1)} mm of rain expected`); }
  if (gust >= 35) { raise('risky'); reasons.push(`Gusts up to ${Math.round(gust)} mph`); }
  else if (gust >= 25) { raise('watch'); reasons.push(`Gusts up to ${Math.round(gust)} mph`); }
  if (hottest >= 95) { raise('risky'); reasons.push(`Heat around ${Math.round(hottest)}°F`); }
  else if (hottest >= 88) { raise('watch'); reasons.push(`Warm, around ${Math.round(hottest)}°F`); }
  if (coldest <= 28) { raise('risky'); reasons.push(`Freezing, ${Math.round(coldest)}°F`); }
  else if (coldest <= 38) { raise('watch'); reasons.push(`Cold, ${Math.round(coldest)}°F`); }
  if (codes.some((code) => FOG.has(code))) { raise('watch'); reasons.push('Fog'); }

  const day = dayName(startsAt);
  const time = clock(startsAt);
  const summary = `${tempF}°F · ${condition.label}`;

  const family =
    level === 'good'
      ? `Looks great for ${day} at ${time}: ${tempF}°F and ${condition.label.toLowerCase() === 'clear' ? 'clear' : condition.label.toLowerCase()}. See you on the field!`
      : level === 'watch'
        ? `A bit unsettled around ${day}’s ${time} session. ${reasons[0]}. Pack accordingly. We’ll tell you here if anything changes.`
        : `Weather watch for ${day} at ${time}: ${reasons[0].toLowerCase()}. Nothing has changed yet. Please wait for your coach’s or the club’s call before you head out.`;

  const staff =
    level === 'good'
      ? `${summary}. No weather concerns for ${day} at ${time}.`
      : `${reasons.join(' · ')}. ${level === 'risky' ? 'Consider telling families early. Nothing is announced until you do.' : 'Worth keeping an eye on.'}`;

  const icon: Outlook['icon'] = level === 'risky' && !condition.icon.includes('rain') && !condition.icon.includes('thunder') && !condition.icon.includes('snow') ? 'warning-outline' : condition.icon;

  return { level, summary, tempF, family, staff, reasons, icon };
}

/** Days away, so the app only forecasts what a forecast can honestly cover. */
export function withinForecastRange(startsAt: string, now = new Date(), days = 9) {
  const start = wall(startsAt.slice(0, 16));
  const nowWall = wall(now.toLocaleString('sv-SE', { timeZone: 'America/New_York' }).replace(' ', 'T').slice(0, 16));
  return start >= nowWall - 60 * 60_000 && start <= nowWall + days * 86_400_000;
}
