import type { LocatedPitch } from '@/lib/pitchCoords';

export const PIN_CLEAR = '#2E9E5B';
export const PIN_BUSY = '#E8622C';
export const PIN_GOLD = '#e9a13b';
export const PIN_INK = '#0A241C';
export const LIGHT_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
export const LIGHT_TILES_A = LIGHT_TILES;

export type PitchMapProps = {
  pitches: LocatedPitch[];
  selectedId?: string;
  topPickId?: string;
  reducedMotion?: boolean;
  frameKey: string;
  flyNonce: number;
  sizeKey?: string | number;
  onSelect: (id: string) => void;
  onBackground?: () => void;
};
