import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { DrawCheck } from '@/components/interactions/DrawCheck';
import { PressableScale } from '@/components/motion';
import { StatusPill } from '@/components/ui';
import { privacyName } from '@/lib/attendance';
import { haptic } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/reducedMotion';
import { motion } from '@/theme/motion';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { AttendanceMark, Person } from '@/types/domain';

const cycle: AttendanceMark['status'][] = ['present', 'absent', 'late'];

export function AttendanceRoster({
  roster,
  recorded,
  authorizedNames,
  missingRsvpIds,
  onMark,
  onMarkAllPresent,
}: {
  roster: Person[];
  recorded: AttendanceMark[];
  authorizedNames: boolean;
  missingRsvpIds?: string[];
  onMark: (person: Person, status: AttendanceMark['status']) => void;
  onMarkAllPresent: () => void;
}) {
  const reduced = useReducedMotion();
  const presentCount = recorded.filter((item) => item.status !== 'absent' && item.present).length;
  const unrecorded = roster.filter((person) => !recorded.some((item) => item.personId === person.id));
  const complete = roster.length > 0 && unrecorded.length === 0;
  const progress = useSharedValue(roster.length ? presentCount / roster.length : 0);

  useEffect(() => {
    progress.value = reduced
      ? roster.length
        ? presentCount / roster.length
        : 0
      : withTiming(roster.length ? presentCount / roster.length : 0, { duration: motion.duration.enter });
  }, [presentCount, roster.length, progress, reduced]);

  const bar = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` as `${number}%` }));

  return (
    <View>
      <View style={styles.head}>
        <Text style={styles.progressLabel}>
          {complete ? 'Attendance complete' : `${presentCount} present · ${unrecorded.length} not recorded`}
        </Text>
        <Animated.View style={styles.track}>
          <Animated.View style={[styles.fill, bar]} />
        </Animated.View>
      </View>
      {!complete ? (
        <PressableScale
          onPress={() => {
            onMarkAllPresent();
            haptic('success');
          }}
          style={styles.markAll}
        >
          <Ionicons name="checkmark-done-outline" size={18} color={colors.white} />
          <Text style={styles.markAllText}>Mark everyone present</Text>
        </PressableScale>
      ) : (
        <Text style={styles.done}>Roster is complete. Tap a name to record an exception.</Text>
      )}
      {roster.map((person) => {
        const mark = recorded.find((item) => item.personId === person.id);
        const missing = missingRsvpIds?.includes(person.id);
        const tone = mark?.status === 'present' ? 'success' : mark?.status === 'late' ? 'warning' : mark?.status === 'absent' ? 'neutral' : 'neutral';
        return (
          <Pressable
            key={person.id}
            accessibilityRole="button"
            accessibilityState={{ selected: Boolean(mark) }}
            onPress={() => {
              const next = cycle[(cycle.indexOf(mark?.status ?? 'late') + 1) % cycle.length];
              haptic('light');
              onMark(person, next);
            }}
            style={[styles.row, mark?.status === 'present' && styles.rowOn]}
          >
            <View style={[styles.dot, mark?.status === 'present' && styles.dotOn]}>
              {mark?.status === 'present' ? <DrawCheck active color={colors.white} size={14} /> : null}
            </View>
            <View style={styles.flex}>
              <Text style={styles.name}>{privacyName(person, authorizedNames)}</Text>
              {missing && !mark ? <Text style={styles.missing}>Missing RSVP</Text> : null}
            </View>
            <StatusPill label={mark ? mark.status : 'Not recorded'} tone={tone} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { marginBottom: spacing.md, gap: spacing.sm },
  progressLabel: { color: colors.ink, fontSize: 13, ...typography.heading },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.sand, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.success, borderRadius: 3 },
  markAll: {
    minHeight: 48,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  markAllText: { color: colors.white, fontSize: 13, ...typography.heading },
  done: { color: colors.success, fontSize: 13, marginBottom: spacing.md, ...typography.heading },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: spacing.xs, borderRadius: radius.sm },
  rowOn: { backgroundColor: colors.successSoft },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: colors.success, borderColor: colors.success },
  flex: { flex: 1 },
  name: { color: colors.ink, ...typography.heading },
  missing: { color: colors.warning, fontSize: 11, marginTop: 2, ...typography.body },
});
