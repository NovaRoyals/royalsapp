export const ROY_STATES = ['idle', 'enter', 'wave', 'pointDown', 'celebrate', 'bounce', 'exit'] as const;

export type RoyState = (typeof ROY_STATES)[number];

/** Independent layers. PNG mode composes these; SVG parts will bind 1:1. */
export const ROY_PARTS = [
  'root',
  'body',
  'head',
  'face',
  'leftEye',
  'rightEye',
  'mouth',
  'leftArm',
  'rightArm',
  'leftLeg',
  'rightLeg',
  'tail',
] as const;

export type RoyPartId = (typeof ROY_PARTS)[number];

export type RoyHandle = {
  play: (state: RoyState) => void;
};

export type RoySize = number;
