export const motion = {
  duration: {
    fast: 120,
    tab: 170,
    base: 200,
    enter: 180,
    content: 160,
    celebrate: 380,
  },
  easing: {
    standard: [0.16, 1, 0.3, 1] as const,
    emphasized: [0.2, 0, 0, 1] as const,
  },
  spring: {
    press: { damping: 18, stiffness: 420 },
    success: { damping: 18, stiffness: 260 },
  },
  offset: {
    tabEnter: 6,
  },
  press: {
    scale: 0.97,
    opacity: 0.86,
  },
} as const;
