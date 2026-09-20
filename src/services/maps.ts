export function mapsSearchUrl(venue: string, address?: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(`${venue} ${address ?? ''}`.trim())}`;
}

export function mapsDirectionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
