import { Platform } from 'react-native';

export const colors = {
  ink: '#151310',
  inkSoft: '#25211D',
  charcoal: '#332E29',
  cream: '#F7F3EC',
  paper: '#FFFCF7',
  orange: '#F36A21',
  orangeDark: '#C8470B',
  orangeSoft: '#FFE6D5',
  sand: '#E9E1D5',
  stone: '#756E66',
  white: '#FFFFFF',
  success: '#2F7D59',
  successSoft: '#E2F3EA',
  warning: '#9A6512',
  warningSoft: '#FFF1D1',
  danger: '#B83A32',
  dangerSoft: '#FBE5E2',
  info: '#315F78',
  border: '#DED6CB',
  overlay: 'rgba(21, 19, 16, 0.58)',
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
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const typography = {
  display: {
    fontFamily: Platform.select({ ios: 'Arial Black', android: 'sans-serif-condensed', default: 'Arial Black' }),
    fontWeight: '900' as const,
    letterSpacing: -1.2,
  },
  heading: {
    fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: 'Arial' }),
    fontWeight: '800' as const,
    letterSpacing: -0.45,
  },
  body: {
    fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'Arial' }),
    fontWeight: '400' as const,
  },
  label: {
    fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: 'Arial' }),
    fontWeight: '700' as const,
    letterSpacing: 0.35,
  },
} as const;

export const shadow = Platform.select({
  web: { boxShadow: '0 8px 30px rgba(40, 31, 22, 0.08)' },
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
  contentPadding: 20,
  tabBarHeight: 72,
} as const;
