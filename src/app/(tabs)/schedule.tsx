import { Ionicons } from '@expo/vector-icons';
import { Href, Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CricketMark } from '@/components/icons/CricketMark';
import { PressableScale } from '@/components/motion';
import { AppHeader, Chip, Screen } from '@/components/ui';
import { kidsProgramId } from '@/data/demo';
import { formatEventParts, isEventOver } from '@/lib/datetime';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { ScheduleEvent } from '@/types/domain';

type Filter = 'mine' | 'soccer' | 'cricket' | 'community';

const filters: { id: Filter; label: string }[] = [
  { id: 'mine', label: 'My schedule' },
  { id: 'soccer', label: 'Soccer' },
  { id: 'cricket', label: 'Cricket' },
  { id: 'community', label: 'Club' },
];

function matchesFilter(event: ScheduleEvent, filter: Filter, followedIds: string[]) {
  if (filter === 'soccer' || filter === 'cricket') return event.sport === filter;
  if (filter === 'community') return event.type === 'club_event';
  if (isKids(event) || isWomen(event) || is35Plus(event)) return true;
  return Boolean(
    event.attendance ||
      event.supporterGoing ||
      (event.programId && followedIds.includes(event.programId)) ||
      (event.teamId && followedIds.includes(event.teamId)),
  );
}

function iconFor(event: ScheduleEvent): { kind: 'cricket' } | { kind: 'ion'; name: keyof typeof Ionicons.glyphMap } {
  if (event.sport === 'cricket') return { kind: 'cricket' };
  if (event.type === 'training') return { kind: 'ion', name: 'stopwatch-outline' };
  if (event.type === 'club_event') return { kind: 'ion', name: 'people-outline' };
  return { kind: 'ion', name: 'football-outline' };
}

function isKids(event: ScheduleEvent) {
  return event.programId === kidsProgramId || event.teamId === 'nova-royals-kids-u8';
}

function isWomen(event: ScheduleEvent) {
  return event.programId === 'womens-soccer' || event.teamId === 'nova-royals-women';
}

function is35Plus(event: ScheduleEvent) {
  return event.programId === 'veterans-soccer' || event.teamId === 'nova-royals-35plus';
}

function dayStamp(iso: string) {
  return iso.slice(0, 10);
}

function timeLabel(event: ScheduleEvent) {
  const start = formatEventParts(event.startsAt).time;
  if (!event.endsAt) return start;
  return `${start} – ${formatEventParts(event.endsAt).time}`;
}

type ScheduleRow =
  | { kind: 'pair'; kids: ScheduleEvent; women: ScheduleEvent }
  | { kind: 'single'; event: ScheduleEvent };

function groupRows(events: ScheduleEvent[]): ScheduleRow[] {
  const used = new Set<string>();
  const rows: ScheduleRow[] = [];
  for (const event of events) {
    if (used.has(event.id)) continue;
    const day = dayStamp(event.startsAt);
    if (isKids(event)) {
      const women = events.find((item) => !used.has(item.id) && isWomen(item) && dayStamp(item.startsAt) === day);
      if (women) {
        used.add(event.id);
        used.add(women.id);
        rows.push({ kind: 'pair', kids: event, women });
        continue;
      }
    }
    if (isWomen(event)) {
      const kids = events.find((item) => !used.has(item.id) && isKids(item) && dayStamp(item.startsAt) === day);
      if (kids) {
        used.add(event.id);
        used.add(kids.id);
        rows.push({ kind: 'pair', kids, women: event });
        continue;
      }
    }
    used.add(event.id);
    rows.push({ kind: 'single', event });
  }
  return rows;
}

function EventCard({ event, raised, flush }: { event: ScheduleEvent; raised?: boolean; flush?: boolean }) {
  const glyph = iconFor(event);
  return (
    <Link href={`/event/${event.id}` as Href} asChild>
      <PressableScale style={StyleSheet.flatten([styles.eventCard, !flush && styles.singleCard, event.status === 'completed' && styles.completedCard, raised && styles.raisedCard])}>
        <View style={styles.eventTop}>
          <View style={[styles.eventIcon, event.sport === 'cricket' && styles.cricketIcon]}>
            {glyph.kind === 'cricket'
              ? <CricketMark size={16} color={colors.success} />
              : <Ionicons name={glyph.name} size={18} color={colors.orange} />}
          </View>
          <Text style={styles.time}>{timeLabel(event)}</Text>
        </View>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.subtitle}>{event.subtitle}</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={15} color={colors.stone} />
          <Text numberOfLines={1} style={styles.location}>{event.venue}</Text>
        </View>
        {event.result ? (
          <View style={styles.result}>
            <Text style={styles.resultText}>{event.result}</Text>
          </View>
        ) : event.attendance ? (
          <View style={styles.rsvp}>
            <Ionicons name="checkmark-circle" size={16} color={event.attendance === 'going' ? colors.success : colors.warning} />
            <Text style={styles.rsvpText}>RSVP · {event.attendance.replace('_', ' ')}</Text>
          </View>
        ) : null}
      </PressableScale>
    </Link>
  );
}

export default function ScheduleScreen() {
  const { schedule, followedIds } = useApp();
  const [filter, setFilter] = useState<Filter>('mine');
  const [showPast, setShowPast] = useState(false);
  const filtered = useMemo(
    () =>
      schedule
        .filter((event) => matchesFilter(event, filter, followedIds) && (showPast || !isEventOver(event)))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [filter, schedule, showPast, followedIds],
  );
  const rows = useMemo(() => groupRows(filtered), [filtered]);
  const banner = useMemo(() => {
    if (!filtered.length) return { month: 'Fall', year: '2026' };
    const months = [...new Set(filtered.map((event) => formatEventParts(event.startsAt).month))];
    const names: Record<string, string> = {
      JAN: 'January', FEB: 'February', MAR: 'March', APR: 'April', MAY: 'May', JUN: 'June',
      JUL: 'July', AUG: 'August', SEP: 'September', OCT: 'October', NOV: 'November', DEC: 'December',
    };
    return {
      month: months.length === 1 ? names[months[0]] ?? months[0] : months.map((item) => names[item]?.slice(0, 3) ?? item).join(' – '),
      year: '2026',
    };
  }, [filtered]);

  return (
    <Screen tabScene>
      <AppHeader eyebrow="One club calendar" title="Schedule" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {filters.map((item) => (
          <Chip key={item.id} label={item.label} active={filter === item.id} onPress={() => setFilter(item.id)} />
        ))}
      </ScrollView>

      <View style={styles.monthRow}>
        <View>
          <Text style={styles.month}>{banner.month}</Text>
          <Text style={styles.year}>{banner.year}</Text>
        </View>
        <PressableScale accessibilityRole="button" onPress={() => setShowPast((value) => !value)} style={styles.pastToggle}>
          <Ionicons name={showPast ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={showPast ? colors.orange : colors.stone} />
          <Text style={styles.pastText}>Show results</Text>
        </PressableScale>
      </View>

      {filtered.length === 0 ? (
        <Text style={styles.subtitle}>{showPast ? 'No completed results in this filter.' : 'Nothing in this filter yet.'}</Text>
      ) : null}
      <View style={styles.timeline}>
        {rows.map((row, index) => {
          const anchor = row.kind === 'pair' ? row.kids : row.event;
          const parts = formatEventParts(anchor.startsAt);
          return (
            <View key={row.kind === 'pair' ? `${row.kids.id}|${row.women.id}` : row.event.id} style={styles.eventRow}>
              <View style={styles.dateColumn}>
                <Text style={styles.day}>{parts.weekday}</Text>
                <Text style={styles.dayNumber}>{parts.day}</Text>
                {index < rows.length - 1 ? <View style={styles.line} /> : null}
              </View>
              {row.kind === 'pair' ? (
                <View style={styles.pair}>
                  <View style={styles.pairCol}><EventCard event={row.kids} flush /></View>
                  <View style={styles.pairCol}><EventCard event={row.women} raised flush /></View>
                </View>
              ) : (
                <EventCard event={row.event} />
              )}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { gap: spacing.sm, paddingRight: spacing.xl, paddingBottom: spacing.sm },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.lg },
  month: { color: colors.ink, fontSize: 24, ...typography.heading },
  year: { color: colors.stone, fontSize: 12, ...typography.label },
  pastToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  pastText: { color: colors.charcoal, fontSize: 12, ...typography.label },
  timeline: { gap: 0 },
  eventRow: { flexDirection: 'row', gap: spacing.md },
  dateColumn: { width: 44, alignItems: 'center' },
  day: { color: colors.orangeDark, fontSize: 10, ...typography.label },
  dayNumber: { color: colors.ink, fontSize: 23, ...typography.heading },
  line: { width: 1, flex: 1, minHeight: 110, marginVertical: 6, backgroundColor: colors.border },
  pair: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.lg },
  pairCol: { flex: 1, minWidth: 0 },
  eventCard: { flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  singleCard: { marginBottom: spacing.lg },
  raisedCard: { marginTop: -14 },
  completedCard: { opacity: 0.82 },
  eventTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  eventIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.orangeSoft },
  cricketIcon: { backgroundColor: colors.successSoft },
  time: { flex: 1, color: colors.charcoal, fontSize: 11, ...typography.label },
  title: { color: colors.ink, fontSize: 15, ...typography.heading },
  subtitle: { color: colors.stone, fontSize: 12, marginTop: 3, ...typography.body },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.md },
  location: { flex: 1, color: colors.stone, fontSize: 12, ...typography.body },
  rsvp: { marginTop: spacing.md, flexDirection: 'row', gap: 6, alignItems: 'center' },
  rsvpText: { color: colors.charcoal, fontSize: 11, textTransform: 'uppercase', ...typography.label },
  result: { alignSelf: 'flex-start', marginTop: spacing.md, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.ink },
  resultText: { color: colors.white, fontSize: 11, ...typography.label },
});
