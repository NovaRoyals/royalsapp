import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { AttendanceRoster } from '@/components/interactions/AttendanceRoster';
import { FieldChangeBanner } from '@/components/interactions/ContextCards';
import { CalendarConfirmButton, SupporterButton } from '@/components/interactions/SupporterButton';
import { RsvpChoices } from '@/components/interactions/RsvpChoices';
import { CricketMark } from '@/components/icons/CricketMark';
import { Button, Screen, StatusPill } from '@/components/ui';
import { demoSchedule, demoTeams } from '@/data/demo';
import { estimatedTravelStub, formatEventParts, formatEventWhen, formatLeaveBy } from '@/lib/datetime';
import { useToast } from '@/components/Toast';
import { PressableScale } from '@/components/motion';
import { can } from '@/lib/capabilities';
import { gameDayBrief, isGameDayWindow, travelMinutesStub } from '@/lib/intelligence';
import { canPlayerRsvp, canSeeFullRoster, COACH_TEAM_ID } from '@/lib/membership';
import { safeBack } from '@/lib/nav';
import { shareContent } from '@/lib/share';
import { calendarGateway } from '@/services/calendar';
import { mapsSearchUrl } from '@/services/maps';
import { fieldStatusLabel, weatherForEvent } from '@/services/weather';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { AttendanceMark } from '@/types/domain';

export function generateStaticParams() {
  return demoSchedule.map((item) => ({ id: item.id }));
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { schedule, setAttendance, setSupporter, setFieldStatus, recordCheckIn, recordAllPresent, role, registrations, household } = useApp();
  const toast = useToast();
  const event = schedule.find((item) => item.id === id) ?? schedule[0];
  const [calendarAdded, setCalendarAdded] = useState(false);
  const [factsOpen, setFactsOpen] = useState(false);
  const parts = formatEventParts(event.startsAt);
  const weather = weatherForEvent(event);
  const staffAttendance =
    can(role, 'record_attendance') && Boolean(event.teamId) && (role === 'admin' || event.teamId === COACH_TEAM_ID);
  const canClose = can(role, 'urgent_field_closure');
  const showPlayerRsvp = canPlayerRsvp(role, event, registrations);
  const showSupporter = !showPlayerRsvp && !staffAttendance;
  const isTraining = event.type === 'training';
  const team = demoTeams.find((item) => item.id === event.teamId);
  const roster = team?.roster ?? [];
  const authorizedNames = canSeeFullRoster(role, event.teamId);
  const recorded = event.checkIns ?? [];
  const gameDay = isGameDayWindow(event) ? gameDayBrief(event) : null;
  const leaveBy = formatLeaveBy(event.startsAt, travelMinutesStub(event.venue) + 10);
  const missingRsvpIds = roster.filter((person) => !recorded.some((item) => item.personId === person.id)).map((person) => person.id);

  return (
    <Screen>
      <View style={styles.topbar}>
        <Pressable accessibilityLabel="Go back" onPress={() => safeBack('/(tabs)/schedule')} style={styles.back}><Ionicons name="arrow-back" size={21} /></Pressable>
        <Text style={styles.topTitle}>Event details</Text>
        <PressableScale
          accessibilityLabel="Share event"
          onPress={async () => {
            const result = await shareContent({
              title: event.title,
              message: `${event.title} · ${formatEventWhen(event.startsAt)} · ${event.venue}`,
              url: typeof window !== 'undefined' ? window.location.href : undefined,
            });
            if (result === 'copied') toast('Link copied');
            if (result === 'shared') toast('Shared');
          }}
          style={styles.back}
        >
          <Ionicons name="share-outline" size={20} />
        </PressableScale>
      </View>
      <View style={styles.hero}>
        <View style={styles.date}>
          <Text style={styles.day}>{parts.day}</Text>
          <Text style={styles.month}>{parts.month}</Text>
        </View>
        <StatusPill label={event.sport === 'cricket' ? 'T20 · CCPL' : event.type.replace('_', ' ')} tone="orange" />
        {event.sport === 'cricket' ? (
          <View style={styles.cricketRow}>
            <CricketMark size={18} color={colors.orange} />
            <Text style={styles.cricketLabel}>Manassas1 division</Text>
          </View>
        ) : null}
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.subtitle}>{event.subtitle}</Text>
        {event.subtitle.includes('Session') ? (
          <View style={styles.path}>
            {Array.from({ length: 11 }).map((_, index) => (
              <View key={index} style={[styles.pathDot, index === 0 && styles.pathDotOn]} />
            ))}
          </View>
        ) : null}
      </View>

      {event.status === 'completed' ? (
        <View style={styles.result}><Text style={styles.resultLabel}>{event.demo ? 'FINAL · DEMO' : 'FINAL'}</Text><Text style={styles.resultValue}>{event.result}</Text></View>
      ) : showPlayerRsvp ? (
        <View style={styles.rsvpHero}>
          <Text style={styles.sectionTitle}>Can you make it?</Text>
          <RsvpChoices
            value={event.attendance}
            goingCount={event.goingCount ?? 0}
            onChange={(status) => setAttendance(event.id, status)}
          />
        </View>
      ) : null}

      {showSupporter ? (
        <View style={styles.support}>
          <Text style={styles.sectionTitle}>Coming to support?</Text>
          <SupporterButton
            going={Boolean(event.supporterGoing)}
            count={event.supporterCount ?? 0}
            onToggle={(next) => setSupporter(event.id, next)}
          />
        </View>
      ) : null}

      <FieldChangeBanner closed={event.fieldStatus === 'closed'} venue={event.venue} />

      <View style={styles.statusRow}>
        <StatusPill label={`Field ${fieldStatusLabel(event.fieldStatus)}`} tone={event.fieldStatus === 'closed' ? 'warning' : 'success'} />
        {event.demo ? <StatusPill label="Demo" /> : null}
      </View>

      <View style={styles.travel}>
        <Text style={styles.travelKicker}>GETTING THERE</Text>
        {gameDay?.leaveBy ? <Text style={styles.travelTime}>{gameDay.leaveBy}</Text> : <Text style={styles.travelTime}>{estimatedTravelStub(event.venue)}</Text>}
        <Text style={styles.travelMeta}>
          {travelMinutesStub(event.venue)}-minute drive stub{leaveBy ? ` · ${leaveBy}` : ''} · Field {fieldStatusLabel(event.fieldStatus)} · {event.parkingNotes ?? 'Parking notes closer to kickoff'}
        </Text>
        <Button label="Open directions" icon="navigate-outline" variant="secondary" onPress={() => Linking.openURL(mapsSearchUrl(event.venue, event.address))} />
      </View>

      <PressableScale onPress={() => setFactsOpen((open) => !open)} style={styles.detailsToggle}>
        <Text style={styles.detailsToggleText}>{factsOpen ? 'Hide when, where, weather' : 'When, where, weather & kit'}</Text>
        <Ionicons name={factsOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.stone} />
      </PressableScale>
      {factsOpen ? (
      <View style={styles.details}>
        <Detail icon="time-outline" label="When" value={formatEventWhen(event.startsAt)} />
        <Detail icon="location-outline" label="Where" value={`${event.venue}${event.address ? `\n${event.address}` : ''}`} />
        <Detail icon="cloud-outline" label="Weather" value={`${weather.summary} · ${weather.source}`} />
        <Detail icon="car-outline" label="Parking" value={event.parkingNotes ?? 'Notes post closer to kickoff'} />
        {event.coachName ? <Detail icon="person-outline" label="Coach" value={event.coachName} /> : null}
        {event.whatToBring ? <Detail icon="bag-outline" label="Bring" value={event.whatToBring} last /> : <Detail icon="shirt-outline" label="For" value={event.subtitle} last />}
      </View>
      ) : null}

      {staffAttendance && roster.length ? (
        <View style={styles.staff}>
          <Text style={styles.sectionTitle}>Take attendance</Text>
          <Text style={styles.hint}>U8 roster for this session. Mark everyone present, then record exceptions. Unrecorded names are treated as missing RSVP in this demo.</Text>
          <AttendanceRoster
            roster={roster}
            recorded={recorded}
            authorizedNames={authorizedNames}
            missingRsvpIds={missingRsvpIds}
            onMark={(person, status) =>
              recordCheckIn(event.id, {
                personId: person.id,
                personName: person.displayName,
                status,
                present: status !== 'absent',
              } satisfies AttendanceMark)
            }
            onMarkAllPresent={() => recordAllPresent(event.id, roster)}
          />
          {canClose ? (
            <Button
              label={event.fieldStatus === 'closed' ? 'Reopen field' : 'Close field (urgent alert)'}
              variant="secondary"
              onPress={() => setFieldStatus(event.id, event.fieldStatus === 'closed' ? 'open' : 'closed')}
              style={styles.secondary}
            />
          ) : null}
        </View>
      ) : canClose ? (
        <Button
          label={event.fieldStatus === 'closed' ? 'Reopen field' : 'Close field (urgent alert)'}
          variant="secondary"
          onPress={() => setFieldStatus(event.id, event.fieldStatus === 'closed' ? 'open' : 'closed')}
          style={styles.secondary}
        />
      ) : null}

      <Text style={styles.sectionTitle}>Plan ahead</Text>
      <CalendarConfirmButton
        added={calendarAdded}
        labelIdle={isTraining ? 'Add season session to calendar' : 'Add to calendar'}
        onAdd={() => {
          calendarGateway.add(event);
          setCalendarAdded(true);
        }}
      />
      {event.coachName && event.sport !== 'cricket' ? <Button label="Contact coach" variant="ghost" onPress={() => router.push('/message/coach-priya' as never)} /> : null}
      <View style={styles.demoNote}>
        <Ionicons name="flask-outline" size={19} color={colors.warning} />
        <Text style={styles.demoText}>Travel time is a stub until live maps are configured. Weather and calendar write are stubs. Field status is staff-controlled in demo.</Text>
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
  hero: { minHeight: 240, padding: spacing.xl, marginTop: spacing.md, borderRadius: radius.lg, backgroundColor: colors.ink, justifyContent: 'flex-end', alignItems: 'flex-start' },
  date: { position: 'absolute', top: spacing.xl, right: spacing.xl, width: 68, height: 74, borderRadius: radius.md, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  day: { color: colors.white, fontSize: 29, lineHeight: 31, ...typography.display },
  month: { color: colors.white, fontSize: 11, ...typography.numeric },
  title: { color: colors.white, fontSize: 28, lineHeight: 32, marginTop: spacing.md, ...typography.display },
  subtitle: { color: colors.sand, fontSize: 13, marginTop: 5, ...typography.body },
  cricketRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm },
  cricketLabel: { color: colors.sand, fontSize: 12, ...typography.label },
  path: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  pathDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.28)' },
  pathDotOn: { backgroundColor: colors.orange },
  rsvpHero: { marginTop: spacing.lg },
  detailsToggle: { marginTop: spacing.lg, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailsToggleText: { color: colors.charcoal, ...typography.heading },
  statusRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  travel: { marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.paper, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  travelKicker: { color: colors.orangeDark, fontSize: 10, ...typography.label },
  travelTime: { color: colors.ink, fontSize: 22, ...typography.display },
  travelMeta: { color: colors.stone, fontSize: 12, lineHeight: 18, ...typography.body },
  details: { marginTop: spacing.lg, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.paper },
  detailRow: { paddingVertical: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  detailBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  detailIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  detailLabel: { color: colors.stone, fontSize: 10, textTransform: 'uppercase', ...typography.label },
  detailValue: { color: colors.ink, fontSize: 13, lineHeight: 19, marginTop: 3, ...typography.heading },
  flex: { flex: 1 },
  counts: { marginTop: spacing.md, gap: 2 },
  countLine: { color: colors.charcoal, fontSize: 13, ...typography.body },
  sectionTitle: { color: colors.ink, fontSize: 19, marginTop: spacing.xxl, marginBottom: spacing.sm, ...typography.heading },
  hint: { color: colors.stone, fontSize: 12, lineHeight: 17, marginBottom: spacing.md, ...typography.body },
  rsvpOptions: { flexDirection: 'row', gap: spacing.sm },
  rsvp: { flex: 1, minHeight: 72, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  rsvpActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  rsvpText: { color: colors.charcoal, fontSize: 11, ...typography.label },
  rsvpTextActive: { color: colors.white },
  support: { marginTop: spacing.md, gap: spacing.md },
  staff: { marginTop: spacing.md },
  checkRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border },
  checkName: { color: colors.ink, ...typography.heading },
  result: { marginTop: spacing.xl, padding: spacing.xl, borderRadius: radius.md, backgroundColor: colors.orangeSoft, alignItems: 'center' },
  resultLabel: { color: colors.orangeDark, fontSize: 10, ...typography.label, letterSpacing: 1 },
  resultValue: { color: colors.ink, fontSize: 28, marginTop: spacing.sm, ...typography.display },
  secondary: { marginTop: spacing.sm },
  demoNote: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.warningSoft, flexDirection: 'row', gap: spacing.sm },
  demoText: { flex: 1, color: colors.warning, fontSize: 11, lineHeight: 17, ...typography.body },
});
