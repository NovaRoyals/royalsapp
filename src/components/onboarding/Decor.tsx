import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { CloudBackdrop } from '@/components/brand/CloudBackdrop';
import { FlowLines } from '@/components/onboarding/FlowLines';
import { colors, gradients } from '@/theme/tokens';

function HillLayer({ d, fill }: { d: string; fill: string }) {
  return <Path d={d} fill={fill} />;
}

/** Rolling field under the welcome / success screens. */
export function Hills({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[styles.hills, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 390 240" preserveAspectRatio="none">
        <HillLayer d="M0 240 L0 108 C70 48 130 128 196 86 C260 48 320 110 390 72 L390 240 Z" fill="rgba(6, 28, 20, 0.22)" />
        <HillLayer d="M0 240 L0 148 C90 98 150 168 230 128 C300 96 350 150 390 122 L390 240 Z" fill="rgba(6, 28, 20, 0.34)" />
      </Svg>
    </View>
  );
}

export function FlowBackdrop({ tone, lines = false }: { tone: 'dark' | 'light'; lines?: boolean }) {
  if (tone === 'dark') {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient colors={gradients.night} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
        <CloudBackdrop />
        <Hills />
      </View>
    );
  }
  // Light steps get a soft mint wash that fades into the page, so they are not a flat sheet.
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[colors.mint, colors.cream]} style={styles.wash} />
      {lines ? <FlowLines /> : null}
    </View>
  );
}

/**
 * A soft pool of light behind Roy. It lifts him off the green so the edge of the artwork is
 * never what you notice, and it is still: it fades in once with the screen.
 */
export function RoyGlow({ size = 320, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="royGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor="#7FD1A8" stopOpacity="0.5" />
            <Stop offset="0.55" stopColor="#4FB98A" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#4FB98A" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill="url(#royGlow)" />
      </Svg>
    </View>
  );
}

export function CrownMark({ size = 26, color = colors.white }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size * 0.72} viewBox="0 0 24 16">
      <Path d="M1.6 14.6 3.3 4.1 8.3 8 12 1.9 15.7 8l5-3.9 1.7 10.5z" fill={color} />
    </Svg>
  );
}

export function Confetti() {
  const pieces = [
    { x: '8%', y: '12%', w: 8, h: 14, r: 18, c: colors.amber },
    { x: '22%', y: '8%', w: 10, h: 10, r: 0, c: colors.mintDeep },
    { x: '38%', y: '16%', w: 7, h: 13, r: -28, c: colors.orange },
    { x: '58%', y: '7%', w: 9, h: 9, r: 0, c: colors.white },
    { x: '74%', y: '14%', w: 8, h: 15, r: 42, c: colors.amber },
    { x: '88%', y: '10%', w: 10, h: 10, r: 0, c: colors.mintDeep },
    { x: '12%', y: '28%', w: 8, h: 14, r: -14, c: colors.white },
    { x: '82%', y: '26%', w: 7, h: 12, r: 24, c: colors.orange },
    { x: '46%', y: '4%', w: 8, h: 8, r: 0, c: colors.amber },
    { x: '64%', y: '30%', w: 9, h: 15, r: -36, c: colors.mintDeep },
  ];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: piece.x as `${number}%`,
            top: piece.y as `${number}%`,
            width: piece.w,
            height: piece.h,
            borderRadius: piece.r === 0 ? piece.w / 2 : 3,
            backgroundColor: piece.c,
            opacity: 0.9,
            transform: [{ rotate: `${piece.r}deg` }],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 280 },
  hills: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 240 },
});
