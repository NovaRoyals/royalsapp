import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CountTick } from '@/components/interactions/CountTick';
import { DrawCheck } from '@/components/interactions/DrawCheck';
import { PressableScale } from '@/components/motion';
import { haptic, type HapticKind } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/reducedMotion';
import { motion } from '@/theme/motion';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { AttendanceStatus } from '@/types/domain';

export type RsvpVariant = 'a' | 'b' | 'c';

const choices: { id: AttendanceStatus; label: string }[] = [
  { id: 'going', label: 'Going' },
  { id: 'maybe', label: 'Maybe' },
  { id: 'not_going', label: 'Can’t go' },
];

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
  const duration = durationMs ?? motion.duration.base;

  return (
    <View>
      <View style={styles.row}>
        {choices.map((choice) => (
          <RsvpCard
            key={choice.id}
            choice={choice}
            active={value === choice.id}
            reduced={reduced}
            duration={duration}
            onPress={() => {
              haptic(hapticKind);
              onChange(choice.id);
            }}
          />
        ))}
      </View>
      <View style={styles.meta}>
        <CountTick value={goingCount} suffix="participants going" style={styles.count} />
        {value === 'going' ? <Text style={styles.note}>You’re in. See you Sunday.</Text> : null}
      </View>
    </View>
  );
}

function RsvpCard({
  choice,
  active,
  reduced,
  duration,
  onPress,
}: {
  choice: (typeof choices)[number];
  active: boolean;
  reduced: boolean;
  duration: number;
  onPress: () => void;
}) {
  const fill = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    fill.value = reduced ? (active ? 1 : 0) : withTiming(active ? 1 : 0, { duration });
  }, [active, duration, fill, reduced]);

  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value }));

  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.card, active && styles.cardActive]}>
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: choice.id === 'going' ? colors.success : choice.id === 'maybe' ? colors.ink : colors.charcoal },
          fillStyle,
        ]}
      />
      <View style={styles.inner}>
        {choice.id === 'going' && active ? (
          <DrawCheck active color={colors.white} />
        ) : (
          <Ionicons
            name={choice.id === 'going' ? 'checkmark-outline' : choice.id === 'maybe' ? 'help-outline' : 'close-outline'}
            size={20}
            color={active ? colors.white : colors.stone}
          />
        )}
        <Text style={[styles.label, active && styles.labelActive]}>{choice.label}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  card: {
    flex: 1,
    minHeight: 84,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  cardActive: { borderColor: colors.ink },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  inner: { alignItems: 'center', gap: spacing.xs, zIndex: 1 },
  label: { color: colors.charcoal, fontSize: 11, ...typography.label },
  labelActive: { color: colors.white },
  meta: { marginTop: spacing.md, gap: 4 },
  count: { color: colors.charcoal, fontSize: 13, ...typography.body },
  note: { color: colors.success, fontSize: 13, ...typography.heading },
});
