import { useEffect } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

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
  const offset = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    offset.value = -8;
    offset.value = withTiming(0, { duration: motion.duration.fast });
  }, [value, offset, reduced]);

  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  return (
    <Animated.Text style={[styles.text, style, animated]}>
      {value}
      {suffix ? ` ${suffix}` : ''}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.ink, fontSize: 15, ...typography.heading },
});
