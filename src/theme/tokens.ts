import { Platform } from 'react-native';

import { fonts } from '@/theme/fonts';

export const colors = {
  ink: '#0F3D2E',
  inkSoft: '#165A40',
  charcoal: '#1F3F34',
  cream: '#F2F7F4',
  paper: '#FFFFFF',
  orange: '#E86A32',
  orangeDark: '#C85A24',
  orangeSoft: '#FBE3D4',
  peach: '#CDEBD4',
  mint: '#DCEFE2',
  mintDeep: '#BCDEC9',
  sky: '#DCEBF7',
  sand: '#E4EDE7',
  stone: '#5F736B',
  white: '#FFFFFF',
  greenDeep: '#0B3527',
  night: '#06241A',
  gold: '#F2B63D',
  goldSoft: '#FBF0CF',
  lilac: '#6B5FB5',
  lilacSoft: '#E7E4F7',
  greenBright: '#2E7D5B',
  blue: '#3B7FB8',
  blueSoft: '#E1ECF7',
  teal: '#2A9D93',
  tealSoft: '#DCF1EF',
  amber: '#E0912F',
  amberSoft: '#FBEBD3',
  rose: '#DA5A4E',
  roseSoft: '#FBE3E0',
  success: '#0F3D2E',
  successSoft: '#CDEBD4',
  warning: '#9A6512',
  warningSoft: '#FFF1D1',
  danger: '#B83A32',
  dangerSoft: '#FBE5E2',
  info: '#315F78',
  border: '#DCE8E0',
  overlay: 'rgba(11, 53, 39, 0.58)',
} as const;

/** Card tints for color play. Each pairs a soft fill with a stronger accent for icons and small text. */
export const tints = {
  mint: { bg: colors.mint, accent: colors.greenBright },
  gold: { bg: colors.goldSoft, accent: '#B7791F' },
  sky: { bg: colors.sky, accent: colors.blue },
  blush: { bg: colors.roseSoft, accent: colors.rose },
  lilac: { bg: colors.lilacSoft, accent: colors.lilac },
} as const;

export type TintName = keyof typeof tints;

export const gradients = {
  night: [colors.night, colors.greenDeep, colors.inkSoft] as const,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  input: 12,
  control: 12,
  md: 14,
  card: 18,
  lg: 20,
  panel: 24,
  xl: 26,
  pill: 999,
} as const;

export const typography = {
  display: {
    fontFamily: fonts.display,
    letterSpacing: -0.4,
  },
  heading: {
    fontFamily: fonts.extraBold,
    letterSpacing: -0.25,
  },
  pageTitle: {
    fontFamily: fonts.extraBold,
    letterSpacing: -0.3,
  },
  body: {
    fontFamily: fonts.regular,
  },
  bodyMedium: {
    fontFamily: fonts.medium,
  },
  label: {
    fontFamily: fonts.bold,
    letterSpacing: 0.35,
  },
  numeric: {
    fontFamily: fonts.display,
    letterSpacing: 0.2,
  },
} as const;

export const shadow = Platform.select({
  web: { boxShadow: '0 8px 30px rgba(15, 61, 46, 0.08)' },
  default: {
    shadowColor: colors.ink,
    shadowOpacity: 0.09,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
});

export const layout = {
  maxWidth: 720,
  /** Onboarding and other single-column flows read better at phone width. */
  flowWidth: 440,
  contentPadding: 20,
  tabBarHeight: 72,
} as const;

export const cardShadow = Platform.select({
  web: { boxShadow: '0 2px 10px rgba(11, 53, 39, 0.06)' },
  default: {
    shadowColor: colors.greenDeep,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
});
