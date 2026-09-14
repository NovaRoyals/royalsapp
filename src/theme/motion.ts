export const motion = {
  duration: {
    fast: 120,
    base: 200,
    enter: 240,
    celebrate: 420,
  },
  easing: {
    standard: [0.2, 0.8, 0.2, 1] as const,
    emphasized: [0.2, 0, 0, 1] as const,
  },
  spring: {
    press: { damping: 18, stiffness: 420 },
    success: { damping: 14, stiffness: 280 },
  },
  offset: {
    tabExit: 5,
    tabEnter: 7,
  },
  press: {
    scale: 0.97,
    opacity: 0.86,
  },
} as const;
