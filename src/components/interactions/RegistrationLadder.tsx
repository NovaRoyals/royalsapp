import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import type { Ladder, LadderStep } from '@/lib/registrationFlow';
import { useReducedMotion } from '@/lib/reducedMotion';
import { colors, radius, spacing, typography } from '@/theme/tokens';

/**
 * Where a registration stands, as four steps. It stays on screen, so the answer to "what
 * happens next?" never depends on remembering a toast. When a step completes while you are
 * looking at it, its marker pops once; on first show nothing moves.
 */
export function RegistrationLadder({ ladder }: { ladder: Ladder }) {
  return (
    <View accessibilityRole="list" style={styles.wrap}>
      {ladder.steps.map((step, index) => (
        <Step key={step.id} step={step} last={index === ladder.steps.length - 1} />
      ))}
    </View>
  );
}

function Step({ step, last }: { step: LadderStep; last: boolean }) {
  const reduced = useReducedMotion();
  const pop = useSharedValue(1);
  const previous = useRef(step.state);

  useEffect(() => {
    if (previous.current !== step.state && step.state === 'done' && !reduced) {
      pop.value = withSequence(withTiming(1.22, { duration: 130 }), withTiming(1, { duration: 170 }));
    }
    previous.current = step.state;
  }, [pop, reduced, step.state]);

  const markerStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const done = step.state === 'done';
  const current = step.state === 'current';
  const stopped = step.state === 'stopped';

  return (
    <View accessibilityRole="text" accessibilityLabel={`${step.label}: ${step.detail}`} style={styles.row}>
      <View style={styles.rail}>
        <Animated.View style={[styles.marker, done && styles.markerDone, current && styles.markerCurrent, stopped && styles.markerStopped, markerStyle]}>
          {done ? <Ionicons accessible={false} name="checkmark" size={15} color={colors.white} /> : null}
          {stopped ? <Ionicons accessible={false} name="close" size={15} color={colors.white} /> : null}
          {current ? <View style={styles.currentDot} /> : null}
        </Animated.View>
        {!last ? <View style={[styles.line, done && styles.lineDone]} /> : null}
      </View>
      <View style={styles.copy}>
        <Text style={[styles.label, step.state === 'upcoming' && styles.muted]}>{step.label}</Text>
        <Text style={[styles.detail, step.state === 'upcoming' && styles.muted, current && styles.detailCurrent]}>{step.detail}</Text>
      </View>
    </View>
  );
}

const MARKER = 28;

const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, minHeight: 58 },
  rail: { width: MARKER, alignItems: 'center' },
  marker: {
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDone: { backgroundColor: colors.ink, borderColor: colors.ink },
  markerCurrent: { borderColor: colors.orange },
  markerStopped: { backgroundColor: colors.danger, borderColor: colors.danger },
  currentDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.orange },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  lineDone: { backgroundColor: colors.ink },
  copy: { flex: 1, paddingBottom: spacing.md },
  label: { color: colors.ink, fontSize: 15, ...typography.heading },
  detail: { color: colors.stone, fontSize: 13, lineHeight: 18, marginTop: 1, ...typography.body },
  detailCurrent: { color: colors.charcoal },
  muted: { opacity: 0.55 },
});
