import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Screen, StatusPill } from '@/components/ui';
import { demoSchedule } from '@/data/demo';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { AttendanceStatus } from '@/types/domain';

const options: { id: AttendanceStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'going', label: 'Going', icon: 'checkmark' },
  { id: 'maybe', label: 'Maybe', icon: 'help' },
  { id: 'not_going', label: 'Can’t go', icon: 'close' },
];

export function generateStaticParams() {
  return demoSchedule.map((item) => ({ id: item.id }));
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { schedule, setAttendance } = useApp();
  const event = schedule.find((item) => item.id === id) ?? schedule[0];
  const [calendarAdded, setCalendarAdded] = useState(false);
  const date = new Date(event.startsAt);

  return (
    <Screen>
      <View style={styles.topbar}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={21} /></Pressable>
        <Text style={styles.topTitle}>Event details</Text>
        <Pressable accessibilityLabel="Share event" style={styles.back}><Ionicons name="share-outline" size={20} /></Pressable>
      </View>
      <View style={styles.hero}>
        <View style={styles.date}>
          <Text style={styles.day}>{date.getDate()}</Text>
          <Text style={styles.month}>{date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</Text>
        </View>
        <StatusPill label={event.type.replace('_', ' ')} tone="orange" />
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.subtitle}>{event.subtitle}</Text>
      </View>

      <View style={styles.details}>
        <Detail icon="time-outline" label="When" value={`${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`} />
        <Detail icon="location-outline" label="Where" value={`${event.venue}${event.address ? `\n${event.address}` : ''}`} />
        <Detail icon="shirt-outline" label="For" value={event.subtitle} last />
      </View>

      {event.status === 'completed' ? (
        <View style={styles.result}><Text style={styles.resultLabel}>FINAL</Text><Text style={styles.resultValue}>{event.result}</Text></View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Can you make it?</Text>
          <View style={styles.rsvpOptions}>
            {options.map((option) => {
              const active = event.attendance === option.id;
              return (
                <Pressable key={option.id} onPress={() => setAttendance(event.id, option.id)} style={[styles.rsvp, active && styles.rsvpActive]}>
                  <Ionicons name={option.icon} size={20} color={active ? colors.white : colors.stone} />
                  <Text style={[styles.rsvpText, active && styles.rsvpTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>Plan ahead</Text>
      <Button
        label={calendarAdded ? 'Added to calendar' : 'Add to calendar'}
        icon={calendarAdded ? 'checkmark' : 'calendar-outline'}
        variant={calendarAdded ? 'secondary' : 'primary'}
        onPress={() => setCalendarAdded(true)}
      />
      <Button
        label="Open location"
        icon="navigate-outline"
        variant="secondary"
        onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(`${event.venue} ${event.address ?? ''}`)}`)}
        style={styles.secondary}
      />
      <View style={styles.demoNote}>
        <Ionicons name="flask-outline" size={19} color={colors.warning} />
        <Text style={styles.demoText}>This is demo schedule data. Calendar state is simulated until native calendar permissions are enabled.</Text>
      </View>
    </Screen>
  );
}

function Detail({ icon, label, value, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, !last && styles.detailBorder]}>
      <View style={styles.detailIcon}><Ionicons name={icon} size={20} color={colors.orangeDark} /></View>
      <View style={styles.flex}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.ink, fontSize: 15, ...typography.heading },
  hero: { minHeight: 270, padding: spacing.xl, marginTop: spacing.md, borderRadius: radius.lg, backgroundColor: colors.ink, justifyContent: 'flex-end', alignItems: 'flex-start' },
  date: { position: 'absolute', top: spacing.xl, right: spacing.xl, width: 68, height: 74, borderRadius: radius.md, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  day: { color: colors.white, fontSize: 29, lineHeight: 31, ...typography.heading },
  month: { color: colors.white, fontSize: 10, ...typography.label, letterSpacing: 1 },
  title: { color: colors.white, fontSize: 27, lineHeight: 31, marginTop: spacing.md, ...typography.heading },
  subtitle: { color: colors.sand, fontSize: 13, marginTop: 5, ...typography.body },
  details: { marginTop: spacing.xl, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.paper },
  detailRow: { paddingVertical: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  detailBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  detailIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  detailLabel: { color: colors.stone, fontSize: 10, textTransform: 'uppercase', ...typography.label },
  detailValue: { color: colors.ink, fontSize: 13, lineHeight: 19, marginTop: 3, ...typography.heading },
  flex: { flex: 1 },
  sectionTitle: { color: colors.ink, fontSize: 19, marginTop: spacing.xxl, marginBottom: spacing.md, ...typography.heading },
  rsvpOptions: { flexDirection: 'row', gap: spacing.sm },
  rsvp: { flex: 1, minHeight: 72, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  rsvpActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  rsvpText: { color: colors.charcoal, fontSize: 11, ...typography.label },
  rsvpTextActive: { color: colors.white },
  result: { marginTop: spacing.xl, padding: spacing.xl, borderRadius: radius.md, backgroundColor: colors.orangeSoft, alignItems: 'center' },
  resultLabel: { color: colors.orangeDark, fontSize: 10, ...typography.label, letterSpacing: 1 },
  resultValue: { color: colors.ink, fontSize: 21, marginTop: spacing.sm, ...typography.heading },
  secondary: { marginTop: spacing.sm },
  demoNote: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.warningSoft, flexDirection: 'row', gap: spacing.sm },
  demoText: { flex: 1, color: colors.warning, fontSize: 11, lineHeight: 17, ...typography.body },
});
