import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Pressable, type PressableProps, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/reducedMotion';
import { colors } from '@/theme/tokens';
import { motion } from '@/theme/motion';

const ease = Easing.bezier(motion.easing.standard[0], motion.easing.standard[1], motion.easing.standard[2], motion.easing.standard[3]);

let didInitialTabPaint = false;

export function PressableScale({ style, children, ...props }: PressableProps) {
  const reduced = useReducedMotion();
  return (
    <Pressable
      {...props}
      style={(state) => [
        typeof style === 'function' ? style(state) : style,
        state.pressed && !reduced ? { opacity: motion.press.opacity, transform: [{ scale: motion.press.scale }] } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function TabBarIcon({
  outline,
  filled,
  focused,
  size,
}: {
  outline: keyof typeof Ionicons.glyphMap;
  filled: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  size: number;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = reduced
      ? focused
        ? 1
        : 0
      : withTiming(focused ? 1 : 0, { duration: motion.duration.base, easing: ease });
  }, [focused, progress, reduced]);

  const outlineStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const filledStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
      <Animated.View style={[{ position: 'absolute' }, outlineStyle]} pointerEvents="none">
        <Ionicons name={outline} size={size} color={colors.stone} />
      </Animated.View>
      <Animated.View style={filledStyle} pointerEvents="none">
        <Ionicons name={filled} size={size} color={colors.orange} />
      </Animated.View>
    </View>
  );
}

export function TabScene({ children }: { children: ReactNode }) {
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const progress = useSharedValue(1);
  useEffect(() => {
    if (!focused) return;
    if (!didInitialTabPaint) {
      didInitialTabPaint = true;
      return;
    }
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: motion.duration.enter, easing: ease });
  }, [focused, progress, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [motion.offset.tabEnter, 0]) }],
  }));

  return <Animated.View style={[{ flex: 1 }, animatedStyle]}>{children}</Animated.View>;
}

export function onTabPressHaptic(alreadyFocused: boolean) {
  if (!alreadyFocused) haptic('light');
}
