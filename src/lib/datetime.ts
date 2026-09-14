const ZONE = 'America/New_York';

export function formatEventParts(iso: string) {
  const date = new Date(iso);
  return {
    day: date.toLocaleDateString('en-US', { timeZone: ZONE, day: 'numeric' }),
    month: date.toLocaleDateString('en-US', { timeZone: ZONE, month: 'short' }).toUpperCase(),
    weekday: date.toLocaleDateString('en-US', { timeZone: ZONE, weekday: 'short' }).toUpperCase(),
    time: date.toLocaleTimeString('en-US', { timeZone: ZONE, hour: 'numeric', minute: '2-digit' }),
  };
}

export function formatEventWhen(iso: string) {
  const date = new Date(iso);
  const long = date.toLocaleDateString('en-US', {
    timeZone: ZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  return `${long} · ${formatEventParts(iso).time}`;
}

export function estimatedTravelStub(venue: string) {
  if (venue.toLowerCase().includes('nottoway')) return '18 min from Fairfax (stub · live maps off)';
  if (venue.toLowerCase().includes('lawrence')) return '24 min from Fairfax (stub · live maps off)';
  if (venue.toLowerCase().includes('cricket')) return '32 min from Fairfax (stub · live maps off)';
  return '22 min from Fairfax (stub · live maps off)';
}
