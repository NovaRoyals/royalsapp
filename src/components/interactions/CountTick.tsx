import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/lib/reducedMotion';
import { motion } from '@/theme/motion';
import { colors, typography } from '@/theme/tokens';

export function CountTick({
  value,
  suffix,
  style,
}: {
  value: number;
  suffix?: string;
  style?: TextStyle;
}) {
  const reduced = useReducedMotion();
  const fromRef = useRef(value);
  const [animated, setAnimated] = useState(value);
  const shown = reduced ? value : animated;
  const bump = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      fromRef.current = value;
      return;
    }
    if (fromRef.current === value) return;
    const from = fromRef.current;
    fromRef.current = value;
    bump.value = 1.08;
    bump.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / motion.duration.enter);
      setAnimated(Math.round(from + (value - from) * t));
      if (t < 1) frame = requestAnimationFrame(tick);
      else setAnimated(value);
    };
    frame = requestAnimationFrame(tick);
    const fallback = setTimeout(() => setAnimated(value), motion.duration.enter + 40);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(fallback);
      setAnimated(value);
    };
  }, [value, reduced, bump]);

  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));

  return (
    <Animated.Text style={[styles.text, style, bumpStyle]}>
      {shown}
      {suffix ? ` ${suffix}` : ''}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.ink, fontSize: 15, ...typography.heading },
});
