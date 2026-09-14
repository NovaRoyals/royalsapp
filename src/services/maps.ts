export function mapsSearchUrl(venue: string, address?: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(`${venue} ${address ?? ''}`.trim())}`;
}
