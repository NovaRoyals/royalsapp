import AsyncStorage from '@react-native-async-storage/async-storage';

export const FIELDS_API = 'https://fieldchecker.vercel.app';

export type PitchSurface = 'Turf' | 'Grass';
export type CalendarStatus = 'conflict' | 'no_conflict';

export type PitchEvent = {
  time: string;
  title: string;
  source: string;
  sourceUrl?: string;
  precision?: string;
  status?: string;
};

export type Pitch = {
  id: string;
  name: string;
  pitch: string;
  surface: PitchSurface;
  location: string;
};

export type PitchDay = Pitch & {
  status: CalendarStatus;
  overlapsPickup: boolean;
  events: PitchEvent[];
  overlappingEvents: PitchEvent[];
};

export type FieldCoverage = {
  coverageStart: string;
  coverageEnd: string;
  lastUpdated: string;
  disclaimer: string;
  incompleteCalendars: boolean;
};

export type PitchDayResult = {
  date: string;
  timeLabel: string;
  lastUpdated: string;
  disclaimer: string;
  suggestionId?: string;
  pitches: PitchDay[];
  fromCache: boolean;
  cachedAt?: string;
};

type CacheShape = {
  coverage?: FieldCoverage;
  catalog?: Pitch[];
  days: Record<string, PitchDayResult>;
};

const CACHE_KEY = 'royals:pitch-calendars:v2';
const memory: CacheShape = { days: {} };

function mapSurface(value: string): PitchSurface {
  return value === 'Grass' ? 'Grass' : 'Turf';
}

function mapPitch(row: { id: string; name: string; subfield?: string; type?: string; location?: string }): Pitch {
  return {
    id: row.id,
    name: row.name,
    pitch: row.subfield?.trim() || 'Main pitch',
    surface: mapSurface(row.type ?? 'Turf'),
    location: row.location ?? '',
  };
}

function mapEvent(row: PitchEvent): PitchEvent {
  return {
    time: row.time,
    title: row.title,
    source: row.source,
    sourceUrl: row.sourceUrl,
    precision: row.precision,
    status: row.status,
  };
}

async function readCache(): Promise<CacheShape> {
  if (memory.coverage || memory.catalog || Object.keys(memory.days).length) return memory;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return memory;
    const parsed = JSON.parse(raw) as CacheShape;
    memory.coverage = parsed.coverage;
    memory.catalog = parsed.catalog;
    memory.days = parsed.days ?? {};
  } catch {
    /* keep empty */
  }
  return memory;
}

function writeCache() {
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify(memory)).catch(() => undefined);
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${FIELDS_API}${path}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error((body as { error?: string }).error ?? `Request failed (${response.status})`);
    (error as Error & { status: number; code?: string }).status = response.status;
    (error as Error & { status: number; code?: string }).code = (body as { error?: string }).error;
    throw error;
  }
  return body as T;
}

function dayKey(date: string, minutes: number, turfOnly: boolean) {
  return `${date}|${minutes}|${turfOnly ? 'turf' : 'all'}`;
}

export async function fetchCoverage(): Promise<FieldCoverage> {
  await readCache();
  try {
    const meta = await getJson<{
      coverageStart: string;
      coverageEnd: string;
      lastUpdated: string;
      disclaimer: string;
    }>('/api');
    let incompleteCalendars = false;
    try {
      const health = await getJson<{
        sourceHealth?: Record<string, { ok?: boolean; provider?: string }>;
      }>('/api/status');
      const watched = ['fxa', 'ncsl', 'nvsl', 'sya'];
      incompleteCalendars = watched.some((key) => health.sourceHealth?.[key] && health.sourceHealth[key].ok === false);
    } catch {
      incompleteCalendars = memory.coverage?.incompleteCalendars ?? false;
    }
    const coverage: FieldCoverage = {
      coverageStart: meta.coverageStart,
      coverageEnd: meta.coverageEnd,
      lastUpdated: meta.lastUpdated,
      disclaimer: meta.disclaimer,
      incompleteCalendars,
    };
    memory.coverage = coverage;
    writeCache();
    return coverage;
  } catch (error) {
    if (memory.coverage) return memory.coverage;
    throw error;
  }
}

export async function fetchCatalog(): Promise<Pitch[]> {
  await readCache();
  try {
    const payload = await getJson<{ fields: { id: string; name: string; subfield?: string; type?: string; location?: string }[] }>(
      '/api/fields',
    );
    const catalog = (payload.fields ?? []).map(mapPitch);
    memory.catalog = catalog;
    writeCache();
    return catalog;
  } catch (error) {
    if (memory.catalog?.length) return memory.catalog;
    throw error;
  }
}

export async function fetchPitchDay(date: string, pickupMinutes: number, turfOnly: boolean): Promise<PitchDayResult> {
  await readCache();
  const key = dayKey(date, pickupMinutes, turfOnly);
  const params = new URLSearchParams({ date, pickupMinutes: String(pickupMinutes) });
  if (turfOnly) params.set('turfOnly', '1');
  try {
    const payload = await getJson<{
      date: string;
      pickupLabel?: string;
      lastUpdated: string;
      disclaimer: string;
      recommendation?: { id: string };
      fields: {
        id: string;
        name: string;
        subfield?: string;
        type?: string;
        location?: string;
        status: CalendarStatus;
        overlapsPickup?: boolean;
        events?: PitchEvent[];
        overlappingEvents?: PitchEvent[];
      }[];
    }>(`/api/schedule?${params.toString()}`);
    const result: PitchDayResult = {
      date: payload.date,
      timeLabel: payload.pickupLabel ?? String(pickupMinutes),
      lastUpdated: payload.lastUpdated,
      disclaimer: payload.disclaimer,
      suggestionId: payload.recommendation?.id,
      pitches: (payload.fields ?? []).map((row) => ({
        ...mapPitch(row),
        status: row.status === 'conflict' ? 'conflict' : 'no_conflict',
        overlapsPickup: Boolean(row.overlapsPickup),
        events: (row.events ?? []).map(mapEvent),
        overlappingEvents: (row.overlappingEvents ?? []).map(mapEvent),
      })),
      fromCache: false,
    };
    memory.days[key] = { ...result, cachedAt: new Date().toISOString() };
    writeCache();
    return result;
  } catch (error) {
    const cached = memory.days[key];
    if (cached) return { ...cached, fromCache: true };
    throw error;
  }
}

export function clampDate(date: string, start?: string, end?: string) {
  if (start && date < start) return start;
  if (end && date > end) return end;
  return date;
}

export function eachDate(start: string, end: string) {
  const dates: string[] = [];
  const [ys, ms, ds] = start.split('-').map(Number);
  const cursor = new Date(Date.UTC(ys, ms - 1, ds));
  const [ye, me, de] = end.split('-').map(Number);
  const last = Date.UTC(ye, me - 1, de);
  while (cursor.getTime() <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}
