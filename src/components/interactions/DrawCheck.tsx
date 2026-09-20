import { useEffect } from 'react';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useReducedMotion } from '@/lib/reducedMotion';
import { colors } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export function DrawCheck({ active, color = colors.white, size = 22 }: { active: boolean; color?: string; size?: number }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = reduced ? (active ? 1 : 0) : withTiming(active ? 1 : 0, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [active, progress, reduced]);

  const props = useAnimatedProps(() => ({
    strokeDashoffset: 28 * (1 - progress.value),
  }));

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <AnimatedPath
        animatedProps={props}
        d="M5 12.5 9.5 17 19 7"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="28"
      />
    </Svg>
  );
}
