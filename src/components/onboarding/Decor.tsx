import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme/tokens';

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

export function FlowBackdrop({ tone }: { tone: 'dark' | 'light' }) {
  if (tone === 'dark') {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.darkGlow} />
        <Hills />
      </View>
    );
  }
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.lightOrbRight} />
      <View style={styles.lightOrbLeft} />
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
  hills: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 240 },
  darkGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: 40,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -140,
  },
  lightOrbRight: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: colors.mint,
    opacity: 0.55,
    top: -140,
    right: -120,
  },
  lightOrbLeft: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.mint,
    opacity: 0.4,
    bottom: -80,
    left: -90,
  },
});
