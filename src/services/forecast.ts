import { useEffect, useState } from 'react';

import { assessOutlook, withinForecastRange, type HourlyPoint, type Outlook } from '@/lib/weather';
import { venueCenter } from '@/lib/pitchCoords';
import type { ScheduleEvent } from '@/types/domain';

/**
 * Live hourly forecast from Open-Meteo. It needs no account or key (a plain GET, with CORS, so it
 * works in the browser and in the app), which means there is no secret to leak. If it cannot be
 * reached, the answer is "no forecast", never a made-up one.
 */

type Forecast = { hours: HourlyPoint[]; fetchedAt: string };

const TTL_MS = 30 * 60_000;
const cache = new Map<string, { at: number; value: Forecast }>();
const inflight = new Map<string, Promise<Forecast | null>>();

type Raw = {
  hourly?: {
    time: string[];
    temperature_2m: (number | null)[];
    precipitation_probability: (number | null)[];
    precipitation: (number | null)[];
    weather_code: (number | null)[];
    wind_speed_10m: (number | null)[];
    wind_gusts_10m: (number | null)[];
  };
};

export function parseForecast(raw: Raw): HourlyPoint[] {
  const h = raw.hourly;
  if (!h?.time) return [];
  return h.time.map((time, index) => ({
    time,
    tempF: h.temperature_2m[index] ?? 0,
    precipProb: h.precipitation_probability[index] ?? 0,
    precipMm: h.precipitation[index] ?? 0,
    windMph: h.wind_speed_10m[index] ?? 0,
    gustMph: h.wind_gusts_10m[index] ?? 0,
    code: h.weather_code[index] ?? 0,
  }));
}

export async function fetchForecast(lat: number, lng: number): Promise<Forecast | null> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const pending = inflight.get(key);
  if (pending) return pending;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    '&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m' +
    '&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=mm&timezone=America%2FNew_York&forecast_days=10';

  const request = (async () => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timer = setTimeout(() => controller?.abort(), 8000);
    try {
      const response = await fetch(url, { signal: controller?.signal });
      if (!response.ok) return null;
      const hours = parseForecast((await response.json()) as Raw);
      if (hours.length === 0) return null;
      const value = { hours, fetchedAt: new Date().toISOString() };
      cache.set(key, { at: Date.now(), value });
      return value;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      inflight.delete(key);
    }
  })();
  inflight.set(key, request);
  return request;
}

const minutes = (event: Pick<ScheduleEvent, 'startsAt' | 'endsAt'>) =>
  event.endsAt ? Math.max(30, Math.round((new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime()) / 60_000)) : 90;

export type OutlookState = { outlook: Outlook | null; fetchedAt?: string; loading: boolean };

/** The outlook for one session, or none if it is too far off, cancelled, or the forecast is unavailable. */
export function useOutlook(event?: Pick<ScheduleEvent, 'id' | 'startsAt' | 'endsAt' | 'venue' | 'status'>): OutlookState {
  const eligible = Boolean(event) && event!.status !== 'cancelled' && event!.status !== 'completed' && withinForecastRange(event!.startsAt);
  const key = event ? `${event.id}|${event.startsAt}|${event.venue}` : '';
  const [fetched, setFetched] = useState<{ key: string; outlook: Outlook | null; fetchedAt?: string } | null>(null);

  useEffect(() => {
    if (!event || !eligible) return;
    let alive = true;
    const { lat, lng } = venueCenter(event.venue);
    fetchForecast(lat, lng).then((forecast) => {
      if (!alive) return;
      setFetched(forecast ? { key, outlook: assessOutlook(forecast.hours, event.startsAt, minutes(event)), fetchedAt: forecast.fetchedAt } : { key, outlook: null });
    });
    return () => {
      alive = false;
    };
  }, [event, eligible, key]);

  if (!eligible) return { outlook: null, loading: false };
  if (fetched?.key !== key) return { outlook: null, loading: true };
  return { outlook: fetched.outlook, fetchedAt: fetched.fetchedAt, loading: false };
}
