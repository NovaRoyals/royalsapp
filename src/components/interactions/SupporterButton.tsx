import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { CountTick } from '@/components/interactions/CountTick';
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
  variant = 'a',
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
  const [note, setNote] = useState(going ? 'Saved · you’re supporting this event.' : '');

  useEffect(() => {
    fill.value = reduced ? (going ? 1 : 0) : withTiming(going ? 1 : 0, { duration: motion.duration.enter });
  }, [going, fill, reduced]);

  const fillStyle = useAnimatedStyle(() =>
    variant === 'b'
      ? { width: `${Math.max(fill.value * 100, 0)}%` as `${number}%` }
      : { opacity: fill.value },
  );

  return (
    <View style={styles.wrap}>
      <PressableScale
        onPress={() => {
          const next = !going;
          onToggle(next);
          setNote(next ? 'Saved · you’re supporting this event.' : 'Support removed.');
          haptic(next ? hapticKind : 'light');
        }}
        style={styles.button}
      >
        <Animated.View style={[styles.fill, variant === 'a' ? styles.fillA : null, fillStyle]} />
        <View style={styles.inner}>
          <Ionicons name={going ? 'heart' : 'heart-outline'} size={18} color={going ? colors.white : colors.ink} />
          <Text style={[styles.label, going && styles.labelOn]}>{going ? 'You’re supporting' : 'I’m coming to support'}</Text>
        </View>
      </PressableScale>
      <View style={styles.meta}>
        <CountTick value={count} suffix="Royals supporting" style={styles.count} />
        {note ? <Text style={styles.note}>{note}</Text> : null}
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
    pop.value = reduced ? (added ? 1 : 0) : withSpring(added ? 1 : 0, motion.spring.success);
  }, [added, pop, reduced]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.85 + pop.value * 0.2 }] }));

  return (
    <View>
      <PressableScale
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
        <Text style={[styles.calLabel, added && styles.labelOn]}>{added ? 'Added' : labelIdle}</Text>
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
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.ink },
  fillA: { borderRadius: radius.md },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, zIndex: 1 },
  label: { color: colors.ink, fontSize: 14, ...typography.heading },
  labelOn: { color: colors.white },
  meta: { gap: 2 },
  count: { color: colors.charcoal, fontSize: 13, ...typography.body },
  note: { color: colors.success, fontSize: 13, marginTop: spacing.sm, ...typography.heading },
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
  calLabel: { color: colors.ink, fontSize: 14, ...typography.heading },
});
