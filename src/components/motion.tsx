import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Pressable, type PressableProps, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/reducedMotion';
import { colors } from '@/theme/tokens';
import { motion } from '@/theme/motion';

const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

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
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons
        accessible={false}
        name={focused ? filled : outline}
        size={size}
        color={focused ? colors.ink : colors.stone}
      />
    </View>
  );
}

export function TabScene({ children }: { children: ReactNode }) {
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      progress.value = focused ? 1 : 0;
      return;
    }
    progress.value = withTiming(focused ? 1 : 0, { duration: motion.duration.tab, easing: easeOut });
  }, [focused, progress, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    flex: 1,
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [motion.offset.tabEnter, 0]) }],
  }));

  return (
    <Animated.View pointerEvents={focused ? 'auto' : 'none'} style={animatedStyle}>
      <View
        accessibilityElementsHidden={!focused}
        importantForAccessibility={focused ? 'auto' : 'no-hide-descendants'}
        // RN-web: Reanimated views do not always forward aria-hidden.
        {...({ 'aria-hidden': !focused } as object)}
        style={{ flex: 1 }}
      >
        {children}
      </View>
    </Animated.View>
  );
}

export function onTabPressHaptic(alreadyFocused: boolean) {
  if (!alreadyFocused) haptic('light');
}
