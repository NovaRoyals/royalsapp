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
import type { AttendanceStatus } from '@/types/domain';

export type RsvpVariant = 'a' | 'b' | 'c';

const choices: { id: AttendanceStatus; label: string; outline: keyof typeof Ionicons.glyphMap; filled: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'going', label: 'Going', outline: 'checkmark-outline', filled: 'checkmark' },
  { id: 'maybe', label: 'Maybe', outline: 'help-outline', filled: 'help' },
  { id: 'not_going', label: 'Can’t go', outline: 'close-outline', filled: 'close' },
];

function confirmation(status: AttendanceStatus) {
  if (status === 'going') return 'You’re in. See you Sunday.';
  if (status === 'maybe') return 'Marked maybe.';
  return 'We’ll miss you.';
}

export function RsvpChoices({
  value,
  goingCount,
  onChange,
  variant = 'a',
  hapticKind = 'light',
  durationMs,
}: {
  value?: AttendanceStatus;
  goingCount: number;
  onChange: (status: AttendanceStatus) => void;
  variant?: RsvpVariant;
  hapticKind?: HapticKind;
  durationMs?: number;
}) {
  const reduced = useReducedMotion();
  const duration = durationMs ?? (variant === 'c' ? motion.duration.fast : motion.duration.enter);
  const [note, setNote] = useState(value ? confirmation(value) : '');

  return (
    <View>
      <View style={styles.row}>
        {choices.map((choice) => (
          <RsvpCard
            key={choice.id}
            choice={choice}
            active={value === choice.id}
            variant={variant}
            reduced={reduced}
            duration={duration}
            onPress={() => {
              onChange(choice.id);
              setNote(confirmation(choice.id));
              haptic(hapticKind);
            }}
          />
        ))}
      </View>
      <View style={styles.meta}>
        <CountTick value={goingCount} suffix="participants going" style={styles.count} />
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
    </View>
  );
}

function RsvpCard({
  choice,
  active,
  variant,
  reduced,
  duration,
  onPress,
}: {
  choice: (typeof choices)[number];
  active: boolean;
  variant: RsvpVariant;
  reduced: boolean;
  duration: number;
  onPress: () => void;
}) {
  const fill = useSharedValue(active ? 1 : 0);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      fill.value = active ? 1 : 0;
      return;
    }
    fill.value = withTiming(active ? 1 : 0, { duration });
    if (active) pop.value = withSpring(1, motion.spring.success);
  }, [active, duration, fill, pop, reduced]);

  const fillStyle = useAnimatedStyle(() => {
    if (variant === 'b') {
      return { width: `${fill.value * 100}%` as `${number}%`, opacity: 1 };
    }
    const scale = variant === 'c' ? 1 : 0.2 + fill.value * 0.8;
    return {
      transform: [{ scale }],
      opacity: fill.value,
    };
  });
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: active ? pop.value : 1 }] }));

  return (
    <PressableScale onPress={onPress} style={[styles.card, active && styles.cardActive]}>
      <Animated.View
        style={[
          styles.fill,
          variant === 'b' ? styles.fillWipe : styles.fillRadial,
          { backgroundColor: choice.id === 'going' ? colors.success : choice.id === 'maybe' ? colors.ink : colors.charcoal },
          fillStyle,
        ]}
      />
      <Animated.View style={[styles.inner, iconStyle]}>
        <Ionicons name={active ? choice.filled : choice.outline} size={20} color={active ? colors.white : colors.stone} />
        <Text style={[styles.label, active && styles.labelActive]}>{choice.label}</Text>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  card: {
    flex: 1,
    minHeight: 76,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  cardActive: { borderColor: colors.ink },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  fillRadial: { width: '140%', height: '140%', borderRadius: 80, alignSelf: 'center' },
  fillWipe: { height: '100%' },
  inner: { alignItems: 'center', gap: spacing.xs, zIndex: 1 },
  label: { color: colors.charcoal, fontSize: 11, ...typography.label },
  labelActive: { color: colors.white },
  meta: { marginTop: spacing.md, gap: 4 },
  count: { color: colors.charcoal, fontSize: 13, ...typography.body },
  note: { color: colors.success, fontSize: 13, ...typography.heading },
});
