import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CountTick } from '@/components/interactions/CountTick';
import { DrawCheck } from '@/components/interactions/DrawCheck';
import { FaceStack } from '@/components/interactions/FaceStack';
import { PressableScale } from '@/components/motion';
import { haptic, type HapticKind } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/reducedMotion';
import { motion } from '@/theme/motion';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export type SupporterVariant = 'a' | 'b' | 'c';

export function SupporterButton({
  going,
  count,
  onToggle,
  hapticKind = 'medium',
}: {
  going: boolean;
  count: number;
  onToggle: (next: boolean) => void;
  variant?: SupporterVariant;
  hapticKind?: HapticKind;
}) {
  const reduced = useReducedMotion();
  const fill = useSharedValue(going ? 1 : 0);
  const bump = useSharedValue(1);

  useEffect(() => {
    fill.value = reduced ? (going ? 1 : 0) : withTiming(going ? 1 : 0, { duration: 320, easing: Easing.out(Easing.cubic) });
    if (going && !reduced) {
      bump.value = 1.06;
      bump.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
    }
  }, [going, fill, reduced, bump]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
  }));
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));

  return (
    <View style={styles.wrap}>
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ selected: going }}
        onPress={() => {
          const next = !going;
          haptic(next ? hapticKind : 'light');
          onToggle(next);
        }}
        style={[styles.button, going && styles.buttonOn]}
      >
        <Animated.View style={[styles.fill, fillStyle]} />
        <View style={styles.inner}>
          {going ? <DrawCheck active color={colors.white} size={18} /> : <Ionicons name="heart-outline" size={18} color={colors.ink} />}
          <Text style={[styles.label, going && styles.labelOn]}>
            {going ? 'You’re supporting' : 'I’m coming to support'}
          </Text>
        </View>
      </PressableScale>
      <View style={styles.meta}>
        <FaceStack count={count} joined={going} />
        <Animated.View style={bumpStyle}>
          <CountTick value={count} suffix="Royals going" style={styles.count} />
        </Animated.View>
      </View>
    </View>
  );
}

export function CalendarConfirmButton({
  added,
  labelIdle,
  onAdd,
}: {
  added: boolean;
  labelIdle: string;
  onAdd: () => void;
}) {
  const reduced = useReducedMotion();
  const pop = useSharedValue(added ? 1 : 0);

  useEffect(() => {
    pop.value = reduced ? (added ? 1 : 0) : withTiming(added ? 1 : 0, { duration: motion.duration.base, easing: Easing.out(Easing.cubic) });
  }, [added, pop, reduced]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.9 + pop.value * 0.1 }] }));

  return (
    <View>
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ selected: added }}
        onPress={() => {
          if (added) return;
          onAdd();
          haptic('success');
        }}
        style={[styles.cal, added && styles.calOn]}
      >
        <Animated.View style={iconStyle}>
          <Ionicons name={added ? 'checkmark' : 'calendar-outline'} size={18} color={added ? colors.white : colors.ink} />
        </Animated.View>
        <Text style={[styles.calLabel, added && styles.labelOn]}>{added ? 'Added to calendar' : labelIdle}</Text>
      </PressableScale>
      {added ? <Text style={styles.note}>Saved on this device · calendar write is a stub.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  buttonOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.orange },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, zIndex: 1 },
  label: { color: colors.ink, fontSize: 14, ...typography.label },
  labelOn: { color: colors.white },
  meta: { gap: spacing.sm, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  count: { color: colors.charcoal, fontSize: 13, ...typography.body },
  note: { color: colors.success, fontSize: 13, marginTop: spacing.sm, ...typography.bodyMedium },
  cal: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  calOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  calLabel: { color: colors.ink, fontSize: 14, ...typography.label },
});
