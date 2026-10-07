import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useReducedMotion } from '@/lib/reducedMotion';
import { colors } from '@/theme/tokens';

/** One full wave is 400 wide, so sliding the strip by 400 lands exactly where it started: a seamless loop. */
const PERIOD = 400;
const WIDTH = PERIOD * 8;

function wavePath(amplitude: number, mid: number) {
  let d = `M0 ${mid}`;
  for (let k = 0; k < WIDTH / (PERIOD / 2); k += 1) {
    const x = (k + 1) * (PERIOD / 2);
    const control = k % 2 === 0 ? mid - amplitude : mid + amplitude;
    d += ` Q ${x - PERIOD / 4} ${control} ${x} ${mid}`;
  }
  return d;
}

type Line = { top: `${number}%`; amplitude: number; seconds: number; color: string; opacity: number; width: number; reverse?: boolean };

// Different heights, speeds and directions so the lines never move in step.
const LINES: Line[] = [
  { top: '8%', amplitude: 26, seconds: 38, color: colors.greenBright, opacity: 0.16, width: 2 },
  { top: '24%', amplitude: 40, seconds: 52, color: colors.mintDeep, opacity: 0.5, width: 3, reverse: true },
  { top: '46%', amplitude: 22, seconds: 44, color: colors.greenBright, opacity: 0.12, width: 2 },
  { top: '64%', amplitude: 46, seconds: 60, color: colors.mintDeep, opacity: 0.55, width: 3, reverse: true },
  { top: '82%', amplitude: 30, seconds: 34, color: colors.amber, opacity: 0.2, width: 2 },
];

function DriftingLine({ line, still }: { line: Line; still: boolean }) {
  const x = useSharedValue(line.reverse ? -PERIOD : 0);
  useEffect(() => {
    if (still) return;
    x.value = line.reverse ? -PERIOD : 0;
    x.value = withRepeat(withTiming(line.reverse ? 0 : -PERIOD, { duration: line.seconds * 1000, easing: Easing.linear }), -1, false);
  }, [line, still, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const height = line.amplitude * 2 + 20;
  return (
    <Animated.View style={[styles.strip, { top: line.top, height, width: WIDTH }, style]}>
      <Svg width={WIDTH} height={height} viewBox={`0 0 ${WIDTH} ${height}`}>
        <Path d={wavePath(line.amplitude, height / 2)} fill="none" stroke={line.color} strokeOpacity={line.opacity} strokeWidth={line.width} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

/**
 * Slow, soft lines drifting across a light screen, like the markings of a pitch seen from above.
 * They sit behind everything, never take a tap, and stand still for anyone who has asked their
 * phone for reduced motion.
 */
export function FlowLines() {
  const reduced = useReducedMotion();
  return (
    <View pointerEvents="none" style={styles.wrap}>
      {LINES.map((line, index) => (
        <DriftingLine key={index} line={line} still={reduced} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  strip: { position: 'absolute', left: 0 },
});
