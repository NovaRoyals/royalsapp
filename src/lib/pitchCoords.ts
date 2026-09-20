import type { PitchDay } from '@/services/fields';

export const CHANTILLY = { lat: 38.88036, lng: -77.40665 } as const;
const FAN = 0.00042;

const VENUES: { match: string; lat: number; lng: number }[] = [
  { match: 'chantilly', lat: 38.88036, lng: -77.40665 },
  { match: 'stringfellow', lat: 38.84563, lng: -77.40159 },
  { match: 'poplar tree', lat: 38.86062, lng: -77.40923 },
  { match: 'westfield', lat: 38.88549, lng: -77.46474 },
  { match: 'lawrence', lat: 38.8581, lng: -77.43731 },
  { match: 'arrowhead', lat: 38.84758, lng: -77.40488 },
  { match: 'centreville', lat: 38.82525, lng: -77.41064 },
  { match: 'sully', lat: 38.9203, lng: -77.4256 },
  { match: 'greenbriar', lat: 38.86624, lng: -77.40549 },
  { match: 'cunningham', lat: 38.89223, lng: -77.24996 },
  { match: 'nottoway', lat: 38.88648, lng: -77.27406 },
  { match: 'arrowbrook', lat: 38.95453, lng: -77.41055 },
  { match: 'oakmont', lat: 38.87665, lng: -77.31515 },
  { match: 'oak marr', lat: 38.87665, lng: -77.31515 },
  { match: 'lake fairfax', lat: 38.9572, lng: -77.3185 },
  { match: 'oakton', lat: 38.8803, lng: -77.2829 },
  { match: 'braddock', lat: 38.82736, lng: -77.40924 },
  { match: 'freedom', lat: 38.9139, lng: -77.535 },
  { match: "byrne", lat: 38.9282, lng: -77.5524 },
  { match: 'hanson', lat: 38.9714, lng: -77.551 },
  { match: 'champe', lat: 38.9323, lng: -77.5659 },
];

export type LocatedPitch = PitchDay & {
  lat: number;
  lng: number;
  venueKey: string;
  venueIndex: number;
  isVenueLabel: boolean;
};

export function venueCenter(name: string) {
  const hay = name.toLowerCase();
  const hit = VENUES.find((item) => hay.includes(item.match));
  return hit ? { lat: hit.lat, lng: hit.lng } : { ...CHANTILLY };
}

export function locatePitches(pitches: PitchDay[]): LocatedPitch[] {
  const groups = new Map<string, PitchDay[]>();
  for (const pitch of pitches) {
    const key = pitch.name;
    const list = groups.get(key) ?? [];
    list.push(pitch);
    groups.set(key, list);
  }

  const located: LocatedPitch[] = [];
  for (const [venueKey, list] of groups) {
    const center = venueCenter(venueKey);
    const size = list.length;
    list.forEach((pitch, index) => {
      const angle = size ? (index / size) * Math.PI * 2 : 0;
      located.push({
        ...pitch,
        lat: size > 1 ? center.lat + Math.sin(angle) * FAN : center.lat,
        lng: size > 1 ? center.lng + Math.cos(angle) * FAN : center.lng,
        venueKey,
        venueIndex: index,
        isVenueLabel: index === 0,
      });
    });
  }
  return located;
}
