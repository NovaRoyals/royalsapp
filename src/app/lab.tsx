import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AttendanceRoster } from '@/components/interactions/AttendanceRoster';
import { CalendarConfirmButton, SupporterButton } from '@/components/interactions/SupporterButton';
import { RsvpChoices, type RsvpVariant } from '@/components/interactions/RsvpChoices';
import { ConfirmationPeak } from '@/components/interactions/ConfirmationPeak';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { IllustrationFrame } from '@/components/illustrations/IllustrationFrame';
import { Screen, StatusPill } from '@/components/ui';
import { haptic, type HapticKind } from '@/lib/haptics';
import { safeBack } from '@/lib/nav';
import { motion } from '@/theme/motion';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { AttendanceMark, AttendanceStatus, Person } from '@/types/domain';

const labRoster: Person[] = [
  { id: 'lab-1', firstName: 'Maya', lastName: 'W', displayName: 'Maya W.' },
  { id: 'lab-2', firstName: 'Aria', lastName: 'P', displayName: 'Aria P.' },
  { id: 'lab-3', firstName: 'Jonah', lastName: 'L', displayName: 'Jonah L.' },
];

export default function InteractionLabScreen() {
  const [rsvpVariant, setRsvpVariant] = useState<RsvpVariant>('a');
  const [rsvp, setRsvp] = useState<AttendanceStatus | undefined>();
  const [goingCount, setGoingCount] = useState(11);
  const [supportVariant, setSupportVariant] = useState<'a' | 'b' | 'c'>('a');
  const [supporting, setSupporting] = useState(false);
  const [supportCount, setSupportCount] = useState(12);
  const [marks, setMarks] = useState<AttendanceMark[]>([]);
  const [calendarAdded, setCalendarAdded] = useState(false);
  const [duration, setDuration] = useState<number>(motion.duration.enter);
  const [hapticKind, setHapticKind] = useState<HapticKind>('light');

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable accessibilityLabel="Go back" onPress={() => safeBack('/(tabs)/profile')} style={styles.back}>
          <Ionicons name="arrow-back" size={21} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.kicker}>DEVELOPMENT · NOT IN TABS</Text>
          <Text style={styles.title}>Interaction Lab</Text>
        </View>
        <StatusPill label="Demo" />
      </View>
      <Text style={styles.lead}>
        Compare variants before accepting a signature interaction. Production currently ships RSVP A, supporter A, and calendar confirmation.
      </Text>
      <Pressable onPress={() => router.push('/roy' as never)} style={styles.royLink}>
        <Text style={styles.copy}>Open Roy Lab to preview mascot animation states.</Text>
        <Ionicons name="sparkles-outline" size={18} color={colors.orange} />
      </Pressable>

      <Section title="Timing (same spring language)">
        <ChipRow
          values={[`${motion.duration.fast}ms`, `${motion.duration.enter}ms`, `${motion.duration.celebrate}ms`]}
          value={`${duration}ms`}
          onChange={(label) => setDuration(Number(label.replace('ms', '')))}
        />
        <SpringSample duration={duration} />
      </Section>
      <Section title="RSVP">
        <ChipRow values={['light', 'medium', 'success']} value={hapticKind} onChange={(value) => setHapticKind(value as HapticKind)} />
        <RsvpChoices
          value={rsvp}
          goingCount={goingCount}
          variant={rsvpVariant}
          durationMs={duration}
          hapticKind={hapticKind}
          onChange={(status) => {
            setGoingCount((count) => {
              const wasGoing = rsvp === 'going';
              if (status === 'going' && !wasGoing) return count + 1;
              if (wasGoing && status !== 'going') return Math.max(0, count - 1);
              return count;
            });
            setRsvp(status);
          }}
        />
      </Section>

      <Section title="Supporter">
        <ChipRow values={['a', 'b', 'c']} value={supportVariant} onChange={setSupportVariant} />
        <SupporterButton
          going={supporting}
          count={supportCount}
          variant={supportVariant}
          onToggle={(next) => {
            setSupporting(next);
            setSupportCount((count) => (next ? count + 1 : Math.max(0, count - 1)));
          }}
        />
      </Section>

      <Section title="Attendance">
        <AttendanceRoster
          roster={labRoster}
          recorded={marks}
          authorizedNames
          missingRsvpIds={['lab-3']}
          onMark={(person, status) => {
            setMarks((current) => [
              ...current.filter((item) => item.personId !== person.id),
              { personId: person.id, personName: person.displayName, status, present: status !== 'absent' },
            ]);
          }}
          onMarkAllPresent={() => {
            setMarks(labRoster.map((person) => ({ personId: person.id, personName: person.displayName, status: 'present', present: true })));
          }}
        />
      </Section>

      <Section title="Calendar">
        <CalendarConfirmButton added={calendarAdded} labelIdle="Add to calendar" onAdd={() => setCalendarAdded(true)} />
      </Section>

      <Section title="Confirmation entrance">
        <ConfirmationPeak
          name="Maya"
          program="Fall Soccer Training 2026"
          sessionLine="Sunday · 9:00 AM · Arrowhead 3A"
          onCalendar={() => undefined}
          onCoach={() => undefined}
          onSeason={() => undefined}
          onShare={() => undefined}
        />
      </Section>

      <Section title="Temporary illustration architecture">
        <IllustrationFrame title="No fixtures yet" message="Placeholder pennant. Not production artwork." />
      </Section>

      <Section title="Haptics">
        <View style={styles.row}>
          {(['light', 'medium', 'success', 'warning'] as HapticKind[]).map((kind) => (
            <Pressable key={kind} onPress={() => haptic(kind)} style={styles.chip}>
              <Text style={styles.chipText}>{kind}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.note}>Web is a no-op. Native devices fire the selected strength.</Text>
      </Section>
    </Screen>
  );
}

function SpringSample({ duration }: { duration: number }) {
  const progress = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 120 }],
  }));
  return (
    <Pressable
      onPress={() => {
        progress.value = 0;
        progress.value = withTiming(1, { duration, easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
      }}
      style={styles.springTrack}
    >
      <Animated.View style={[styles.springDot, style]} />
      <Text style={styles.note}>Tap to preview {duration}ms</Text>
    </Pressable>
  );
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ChipRow<T extends string>({
  values,
  value,
  onChange,
}: {
  values: T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.row}>
      {values.map((item) => (
        <Pressable key={item} onPress={() => onChange(item)} style={[styles.chip, value === item && styles.chipOn]}>
          <Text style={[styles.chipText, value === item && styles.chipOnText]}>{item.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  kicker: { color: colors.orangeDark, fontSize: 10, ...typography.label, letterSpacing: 1.1 },
  title: { color: colors.ink, fontSize: 24, ...typography.heading },
  lead: { color: colors.stone, fontSize: 13, lineHeight: 19, marginTop: spacing.sm, marginBottom: spacing.md, ...typography.body },
  royLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  section: { marginBottom: spacing.xxl, gap: spacing.md },
  sectionTitle: { color: colors.ink, fontSize: 18, ...typography.heading },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.charcoal, fontSize: 11, ...typography.label },
  chipOnText: { color: colors.white },
  copy: { color: colors.charcoal, fontSize: 14, lineHeight: 20, ...typography.body },
  note: { color: colors.stone, fontSize: 12, ...typography.body },
  springTrack: { height: 56, justifyContent: 'center' },
  springDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.orange },
});
