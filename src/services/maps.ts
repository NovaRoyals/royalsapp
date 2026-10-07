export type MapsProviderId = 'demo' | 'apple' | 'google';

export interface MapDestination {
  name: string;
  address?: string;
  fieldNumber?: string;
}

export interface DirectionsPreview {
  label: string;
  destination: string;
  detail: string;
  connected: boolean;
}

export interface MapsProvider {
  id: MapsProviderId;
  connected: boolean;
  directions(destination: MapDestination): DirectionsPreview;
}

class DemoMapsProvider implements MapsProvider {
  id = 'demo' as const;
  connected = false;

  directions(destination: MapDestination): DirectionsPreview {
    const place = [destination.name, destination.fieldNumber].filter(Boolean).join(' · ');
    return {
      label: 'Open directions (demo)',
      destination: place,
      detail: destination.address
        ? `${destination.address}. Turn-by-turn is not connected.`
        : 'Turn-by-turn is not connected.',
      connected: false,
    };
  }
}

/** Apple Maps and Google Maps adapters can replace this provider later. No keys live here. */
export const mapsProvider: MapsProvider = new DemoMapsProvider();

/**
 * One-tap directions to a venue. Apple Maps on iPhone, Google Maps everywhere else (it also
 * opens the Maps app on Apple devices from the web). It is only a link, so it needs no key.
 */
export function directionsUrl(destination: MapDestination, platform: string = 'web') {
  const query = encodeURIComponent([destination.name, destination.address].filter(Boolean).join(', '));
  return platform === 'ios'
    ? `https://maps.apple.com/?daddr=${query}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}

export function mapsSearchUrl(venue: string, address?: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(`${venue} ${address ?? ''}`.trim())}`;
}

export function mapsDirectionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
