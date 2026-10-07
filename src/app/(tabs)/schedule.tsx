import { Href, Link } from 'expo-router';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader, EmptyState, Screen, StatusPill } from '@/components/ui';
import { clubNowPostedIso, formatEventParts, isEventOver } from '@/lib/datetime';
import {
  childNamesOnEvent,
  deadlineCopy,
  eventTypeLabel,
  householdConflicts,
  involvesUser,
  isUrgentEvent,
  laneLabel,
  needsAttentionCopy,
  placeLabel,
  programLane,
  rsvpFor,
  rsvpLabel,
  type ClubLane,
} from '@/lib/operations';
import { readChildFilter, readScheduleScope, subscribeScheduleSession, writeChildFilter, writeScheduleScope, type ScheduleScope } from '@/lib/scheduleSession';
import { fieldStatusLabel } from '@/services/weather';
import { useApp } from '@/state/AppProvider';
import { colors, spacing, typography } from '@/theme/tokens';
import type { ScheduleEvent } from '@/types/domain';

const lanes: { id: ClubLane; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'kids', label: 'Kids' },
  { id: 'open', label: 'Open' },
  { id: 'plus35', label: '35+' },
  { id: 'women', label: 'Women' },
  { id: 'cricket', label: 'Cricket' },
  { id: 'tournament', label: 'Cup' },
  { id: 'community', label: 'Community' },
];

function addDays(ymd: string, days: number) {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

const LATER_PAGE = 12;

function monthKey(event: ScheduleEvent) {
  return new Date(event.startsAt).toLocaleString('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit' });
}

function monthTitle(event: ScheduleEvent) {
  return new Date(event.startsAt).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'long' });
}

function toneFor(event: ScheduleEvent, rsvp?: string) {
  if (event.status === 'cancelled' || event.fieldStatus === 'closed' || rsvp === 'not_going') return 'danger' as const;
  if (event.fieldStatus === 'relocated' || event.previousVenue || rsvp === 'maybe') return 'orange' as const;
  if (rsvp === 'going' || event.supporterGoing) return 'success' as const;
  if (!rsvp) return 'neutral' as const;
  if (event.fieldStatus === 'open') return 'success' as const;
  return 'neutral' as const;
}

export default function ScheduleScreen() {
  const { schedule, role, household, registrations } = useApp();
  const storedScope = useSyncExternalStore(subscribeScheduleSession, readScheduleScope, () => undefined);
  const childFilter = useSyncExternalStore(subscribeScheduleSession, readChildFilter, () => 'all');
  const scope: ScheduleScope = storedScope ?? (role === 'guest' ? 'club' : 'mine');
  const [lane, setLane] = useState<ClubLane>('all');
  const [showPast, setShowPast] = useState(false);
  const [laterLimit, setLaterLimit] = useState(LATER_PAGE);
  const today = clubNowPostedIso().slice(0, 10);
  const weekEnd = addDays(today, 6);

  function selectScope(next: ScheduleScope) {
    writeScheduleScope(next);
  }

  function selectChild(next: string) {
    writeChildFilter(next);
  }

  const childIds = household.children.map((child) => child.id);
  const conflicts = useMemo(
    () => (role === 'guardian' ? householdConflicts(schedule, household.children) : []),
    [household.children, role, schedule],
  );

  const visible = useMemo(() => {
    return schedule
      .filter((event) => {
        if (!showPast && isEventOver(event) && event.status !== 'cancelled') return false;
        if (scope === 'club') {
          if (lane !== 'all' && programLane(event) !== lane) return false;
          return true;
        }
        if (role === 'guest') return false;
        if (!involvesUser(event, role, childIds, registrations) && !conflicts.some((item) => item.a.id === event.id || item.b.id === event.id)) {
          return false;
        }
        if (role === 'guardian' && childFilter !== 'all') {
          const names = childNamesOnEvent(event, household.children);
          const child = household.children.find((item) => item.id === childFilter);
          if (!child || !names.includes(child.firstName)) return false;
        }
        return true;
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [childFilter, childIds, conflicts, household.children, lane, registrations, role, schedule, scope, showPast]);

  const sectionData = useMemo(() => {
    const urgent = visible.filter((event) => !isEventOver(event) && isUrgentEvent(event));
    const urgentIds = new Set(urgent.map((event) => event.id));
    const rest = visible.filter((event) => !urgentIds.has(event.id) && !isEventOver(event));
    const todayEvents = rest.filter((event) => event.startsAt.slice(0, 10) === today);
    const todayIds = new Set(todayEvents.map((event) => event.id));
    const afterToday = rest.filter((event) => !todayIds.has(event.id));
    const next = afterToday.find((event) => involvesUser(event, role, childIds, registrations));
    const afterNext = next ? afterToday.filter((event) => event.id !== next.id) : afterToday;
    const week = afterNext.filter((event) => event.startsAt.slice(0, 10) <= weekEnd);
    const laterAll = afterNext.filter((event) => event.startsAt.slice(0, 10) > weekEnd);
    const later = laterAll.slice(0, laterLimit);
    const earlier = showPast ? visible.filter((event) => isEventOver(event)) : [];
    // Later is split by month so "SUN 25, THU 29, SUN 1" never reads as one run of dates.
    const laterByMonth: { id: string; title: string; events: ScheduleEvent[] }[] = [];
    for (const event of later) {
      const key = monthKey(event);
      const last = laterByMonth[laterByMonth.length - 1];
      if (last && last.id === `later-${key}`) last.events.push(event);
      else laterByMonth.push({ id: `later-${key}`, title: monthTitle(event), events: [event] });
    }
    return {
      list: [
        { id: 'urgent', title: 'Needs attention', events: urgent },
        { id: 'today', title: 'Today', events: todayEvents },
        { id: 'next', title: 'Next for you', events: next ? [next] : [] },
        { id: 'week', title: 'This week', events: week },
        ...laterByMonth,
        { id: 'earlier', title: 'Earlier', events: earlier },
      ].filter((section) => section.events.length > 0),
      hiddenLater: Math.max(0, laterAll.length - later.length),
    };
  }, [childIds, laterLimit, registrations, role, showPast, today, visible, weekEnd]);
  const sections = sectionData.list;

  return (
    <Screen tabScene>
      <AppHeader eyebrow="Schedule" title="What’s on" compactTitle />
      <View accessibilityRole="tablist" style={styles.switch}>
        {([
          ['mine', 'My Schedule'],
          ['club', 'Club Schedule'],
        ] as const).map(([id, label]) => {
          const selected = scope === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              aria-selected={selected}
              onPress={() => selectScope(id)}
              style={[styles.switchItem, selected && styles.switchOn]}
            >
              <Text style={[styles.switchText, selected && styles.switchTextOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {scope === 'mine' && role === 'guardian' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <FilterChip label="Both children" selected={childFilter === 'all'} onPress={() => selectChild('all')} />
          {household.children.map((child) => (
            <FilterChip key={child.id} label={child.firstName} selected={childFilter === child.id} onPress={() => selectChild(child.id)} />
          ))}
        </ScrollView>
      ) : null}

      {scope === 'club' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {lanes.map((item) => (
            <FilterChip key={item.id} label={item.label} selected={lane === item.id} onPress={() => setLane(item.id)} />
          ))}
        </ScrollView>
      ) : null}

      {scope === 'mine' && role === 'guest' ? (
        <Text style={styles.empty}>Club Schedule is open. Household schedules stay with a signed-in family.</Text>
      ) : null}

      {sections.length === 0 && !(scope === 'mine' && role === 'guest') ? (
        <EmptyState pose="lookLeft" title={showPast ? 'Nothing earlier here' : 'Quiet for now'} message={showPast ? 'No earlier events match this view.' : 'Nothing is scheduled in this view yet. Try another filter.'} />
      ) : null}

      {sections.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.group}>
            {section.events.map((event, index) => {
              const conflict = conflicts.find((item) => item.a.id === event.id || item.b.id === event.id);
              const anchorId = conflict && visible.some((item) => item.id === conflict.a.id) ? conflict.a.id : conflict?.b.id;
              const conflictNote =
                conflict && event.id === anchorId
                  ? `${conflict.names.join(' and ')} overlap by ${conflict.minutes} min. One adult may not cover both.`
                  : null;
              return (
                <View key={event.id} style={index > 0 ? styles.rowDivider : undefined}>
                  <EventRow event={event} personal={scope === 'mine'} householdChildren={household.children} />
                  {conflictNote ? <Text style={styles.conflict}>{conflictNote}</Text> : null}
                </View>
              );
            })}
          </View>
        </View>
      ))}

      {sectionData.hiddenLater > 0 ? (
        <Pressable accessibilityRole="button" onPress={() => setLaterLimit((value) => value + LATER_PAGE)} style={styles.past}>
          <Text style={styles.pastText}>Show {Math.min(LATER_PAGE, sectionData.hiddenLater)} more · {sectionData.hiddenLater} left</Text>
        </Pressable>
      ) : null}

      <Pressable accessibilityRole="button" onPress={() => setShowPast((value) => !value)} style={styles.past}>
        <Text style={styles.pastText}>{showPast ? 'Hide earlier events' : 'Show earlier events'}</Text>
      </Pressable>
    </Screen>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.filter, selected && styles.filterOn]}>
      <Text style={[styles.filterText, selected && styles.filterTextOn]}>{label}</Text>
    </Pressable>
  );
}

function EventRow({
  event,
  personal,
  householdChildren,
}: {
  event: ScheduleEvent;
  personal: boolean;
  householdChildren: { id: string; firstName: string }[];
}) {
  const parts = formatEventParts(event.startsAt);
  const names = personal ? childNamesOnEvent(event, householdChildren) : [];
  const own = names.map((name) => {
    const child = householdChildren.find((item) => item.firstName === name);
    const status = child ? rsvpFor(event, child.id) : undefined;
    return status ? `${name}: ${rsvpLabel(status)}` : name;
  });
  const childResponse = names
    .map((name) => {
      const child = householdChildren.find((item) => item.firstName === name);
      return child ? rsvpFor(event, child.id) : undefined;
    })
    .find(Boolean);
  const response = event.attendance ? rsvpLabel(event.attendance) : event.supporterGoing ? 'Supporting' : childResponse ? rsvpLabel(childResponse) : names.length ? 'No response' : undefined;
  const waitingNote = personal ? deadlineCopy(event, 0)[0] : undefined;
  // "Open" on every card said nothing and collided with the Open division, so say only what differs.
  const statusLabel =
    event.status === 'cancelled' ? 'Cancelled' : event.fieldStatus && event.fieldStatus !== 'open' ? fieldStatusLabel(event.fieldStatus) : response;

  return (
    <Link href={`/event/${event.id}` as Href} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={`${eventTypeLabel(event)}, ${event.title}, ${parts.weekday} ${parts.time}`} style={styles.row}>
        <View style={styles.date}>
          <Text style={styles.weekday}>{parts.weekday}</Text>
          <Text style={styles.dayNumber}>{parts.day}</Text>
          <Text style={styles.monthTag}>{parts.month}</Text>
        </View>
        <View style={styles.copy}>
          <Text style={styles.meta}>
            {eventTypeLabel(event)} · {parts.time}
            {personal ? '' : ` · ${laneLabel(programLane(event))}`}
          </Text>
          <Text numberOfLines={2} style={styles.title}>{event.title}</Text>
          <Text numberOfLines={1} style={styles.sub}>
            {personal && names.length ? names.join(names.length > 1 ? ' and ' : '') : event.ageGroup || event.competitionLabel || event.purpose || event.subtitle}
          </Text>
          <Text numberOfLines={1} style={styles.place}>{placeLabel(event)}</Text>
          {event.previousVenue ? <Text style={styles.previous}>Previous · {event.previousVenue}</Text> : null}
          {isUrgentEvent(event) ? <Text style={styles.attention}>{needsAttentionCopy(event)}</Text> : null}
          {waitingNote && !event.attendance && !own.length ? <Text style={styles.deadline}>{waitingNote}</Text> : null}
          {statusLabel ? <View style={styles.pill}><StatusPill label={statusLabel} tone={toneFor(event, event.attendance ?? childResponse)} /></View> : null}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  switch: { flexDirection: 'row', backgroundColor: colors.sand, borderRadius: 12, padding: 3, marginBottom: spacing.md },
  switchItem: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  switchOn: { backgroundColor: colors.paper },
  switchText: { color: colors.stone, fontSize: 13, ...typography.label },
  switchTextOn: { color: colors.ink },
  filters: { gap: spacing.sm, paddingBottom: spacing.md },
  filter: { minHeight: 36, paddingHorizontal: 12, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  filterOn: { backgroundColor: colors.ink },
  filterText: { color: colors.charcoal, fontSize: 12, ...typography.label },
  filterTextOn: { color: colors.white },
  empty: { color: colors.stone, fontSize: 15, lineHeight: 22, marginTop: spacing.lg, ...typography.body },
  section: { marginTop: spacing.lg },
  sectionTitle: { color: colors.stone, fontSize: 12, marginBottom: spacing.sm, ...typography.label },
  group: { backgroundColor: colors.paper, borderRadius: 22, overflow: 'hidden' },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  date: { width: 44, alignItems: 'center', paddingTop: 2 },
  weekday: { color: colors.orangeDark, fontSize: 10, ...typography.label },
  dayNumber: { color: colors.ink, fontSize: 20, fontVariant: ['tabular-nums'], ...typography.heading },
  monthTag: { color: colors.stone, fontSize: 10, textTransform: 'uppercase', ...typography.label },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  meta: { color: colors.stone, fontSize: 12, ...typography.body },
  title: { color: colors.ink, fontSize: 16, ...typography.heading },
  sub: { color: colors.charcoal, fontSize: 13, ...typography.body },
  place: { color: colors.stone, fontSize: 13, ...typography.body },
  previous: { color: colors.stone, fontSize: 12, textDecorationLine: 'line-through', ...typography.body },
  attention: { color: colors.orangeDark, fontSize: 12, marginTop: 2, ...typography.bodyMedium },
  deadline: { color: colors.charcoal, fontSize: 12, ...typography.body },
  pill: { alignSelf: 'flex-start', marginTop: 4 },
  conflict: { color: colors.charcoal, fontSize: 13, lineHeight: 18, paddingHorizontal: spacing.md, paddingBottom: spacing.md, ...typography.body },
  past: { minHeight: 48, justifyContent: 'center', marginTop: spacing.lg },
  pastText: { color: colors.orangeDark, fontSize: 13, ...typography.label },
});
