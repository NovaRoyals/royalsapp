import type { VenuePlace } from '@/types/domain';

export const ARROWHEAD_3A_ID = 'arrowhead-3a';
export const ARROWHEAD_2B_ID = 'arrowhead-2b';
export const ARROWHEAD_1B_ID = 'arrowhead-1b';

export const venueCatalog: VenuePlace[] = [
  {
    id: ARROWHEAD_3A_ID,
    name: 'Arrowhead Park',
    fieldNumber: 'Field 3A',
    address: '5200 Arrowhead Park Dr, Centreville, VA 20120',
    arrival: 'Arrive 15 minutes early. Field 3A is the left 8v8 half of turf Field 3.',
    parkingNotes: 'Use the lot at 5200 Arrowhead Park Drive. Walk past the playground; 3A is the farthest half from the playground side.',
    entrance: 'South sideline, playground landmark behind you as you face the field.',
    surface: 'Turf',
    restrooms: 'Restrooms at the playground pavilion',
  },
  {
    id: ARROWHEAD_2B_ID,
    name: 'Arrowhead Park',
    fieldNumber: 'Field 2B',
    address: '5200 Arrowhead Park Dr, Centreville, VA 20120',
    arrival: 'Field 2B is the near half of Field 2, beside the parking lot.',
    parkingNotes: 'Same Arrowhead lot. Field 2B is closer to the lot than Field 3.',
    entrance: 'East entrance off the main lot. Look for the Field 2 sign.',
    surface: 'Turf',
    restrooms: 'Restrooms at the playground pavilion',
  },
  {
    id: ARROWHEAD_1B_ID,
    name: 'Arrowhead Park',
    fieldNumber: 'Field 1B',
    address: '5200 Arrowhead Park Dr, Centreville, VA 20120',
    arrival: 'Field 1B is the right half of Field 1, nearest the picnic shelter.',
    parkingNotes: 'Same Arrowhead lot. Follow the path toward the picnic shelter.',
    entrance: 'Picnic shelter landmark, then the right-hand half of Field 1.',
    surface: 'Turf',
    restrooms: 'Restrooms at the playground pavilion',
  },
  {
    id: 'nottoway-4a',
    name: 'Nottoway Park',
    fieldNumber: 'Field 4A',
    address: '9601 Courthouse Rd, Vienna, VA 22181',
    arrival: 'Night match. Use the lot nearest Field 4. Lights stay on after 10 PM.',
    parkingNotes: 'Field 4 lot. Do not park along the park road.',
    entrance: 'Gate at the Field 4 end of the lot.',
    surface: 'Turf',
    restrooms: 'Seasonal restrooms by the lot',
  },
  {
    id: 'nottoway-4b',
    name: 'Nottoway Park',
    fieldNumber: 'Field 4B',
    address: '9601 Courthouse Rd, Vienna, VA 22181',
    arrival: 'Night match. Field 4B is the half beside 4A.',
    parkingNotes: 'Field 4 lot.',
    entrance: 'Gate at the Field 4 end of the lot.',
    surface: 'Turf',
  },
  {
    id: 'eclawrence-3a',
    name: 'EC Lawrence Park',
    fieldNumber: 'Field 3A',
    address: '5040 Walney Rd, Chantilly, VA 20151',
    arrival: 'Enter from Walney Road and follow club signs to Field 3.',
    parkingNotes: 'Main park lot, then the path to Field 3.',
    entrance: 'Field 3 gate off the interior path.',
    surface: 'Turf',
  },
  {
    id: 'eclawrence-3b',
    name: 'EC Lawrence Park',
    fieldNumber: 'Field 3B',
    address: '5040 Walney Rd, Chantilly, VA 20151',
    arrival: 'Field 3B shares the Field 3 entrance with 3A.',
    parkingNotes: 'Main park lot.',
    entrance: 'Field 3 gate.',
    surface: 'Turf',
  },
  {
    id: 'manassas-1',
    name: 'Manassas cricket ground',
    fieldNumber: 'Field 1',
    address: 'Manassas, VA',
    arrival: 'Home T20. Allow extra time. Morning league slots fill the lot.',
    parkingNotes: 'Ground lot. Arrive before the start, not at the toss.',
    entrance: 'Club tent on the Field 1 boundary.',
    surface: 'Grass',
    restrooms: 'Ground restrooms when the facility is open',
  },
  {
    id: 'manassas-2',
    name: 'Manassas cricket ground',
    fieldNumber: 'Field 2',
    address: 'Manassas, VA',
    arrival: 'Away T20 at Field 2. Arrive early.',
    parkingNotes: 'Ground lot shared with Field 1.',
    entrance: 'Field 2 boundary, past the main club tent.',
    surface: 'Grass',
  },
];

export function venueById(id?: string) {
  return venueCatalog.find((item) => item.id === id);
}

export function venueTitle(place: VenuePlace) {
  return `${place.name} · ${place.fieldNumber}`;
}

export function venueIdForLabel(venue: string) {
  const hay = venue.toLowerCase();
  if (hay.includes('arrowhead') && hay.includes('2b')) return ARROWHEAD_2B_ID;
  if (hay.includes('arrowhead') && hay.includes('1b')) return ARROWHEAD_1B_ID;
  if (hay.includes('arrowhead')) return ARROWHEAD_3A_ID;
  if (hay.includes('nottoway') && hay.includes('4b')) return 'nottoway-4b';
  if (hay.includes('nottoway')) return 'nottoway-4a';
  if (hay.includes('lawrence') && hay.includes('3b')) return 'eclawrence-3b';
  if (hay.includes('lawrence')) return 'eclawrence-3a';
  if (hay.includes('field 2')) return 'manassas-2';
  if (hay.includes('manassas') || hay.includes('cricket')) return 'manassas-1';
  return undefined;
}
