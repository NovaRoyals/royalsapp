import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FieldChangeBanner, GameDayCard } from '@/components/interactions/ContextCards';
import { PressableScale } from '@/components/motion';
import { AppHeader, Button, DemoBadge, Screen, SectionHeading, StatusPill, textStyles } from '@/components/ui';
import { demoPrograms, kidsProgramId } from '@/data/demo';
import { completedAttendance, mayaAttendanceHistory } from '@/lib/attendance';
import { formatEventParts } from '@/lib/datetime';
import {
  crossClubSuggestion,
  gameDayBrief,
  householdConflictStub,
  isGameDayWindow,
} from '@/lib/intelligence';
import { canOpenSeasonHub, COACH_TEAM_ID, PLAYER_TEAM_ID, notificationsForRole } from '@/lib/membership';
import { fieldStatusLabel } from '@/services/weather';
import { useApp } from '@/state/AppProvider';
import { colors, radius, shadow, spacing, typography } from '@/theme/tokens';

export default function HomeScreen() {
  const { role, household, registrations, schedule, announcements, notifications, hydrated, followedIds, notificationPrefs } = useApp();
  const [childId, setChildId] = useState(household.children[0]?.id);
  const kidsProgram = demoPrograms.find((item) => item.id === kidsProgramId)!;
  const unread = notificationsForRole(role, notifications).filter((item) => !item.read);
  const urgent = unread.find((item) => item.urgency === 'urgent');
  const kidsEvent = schedule.find((event) => event.teamId === COACH_TEAM_ID && event.status === 'scheduled');
  const menEvent = schedule.find((event) => event.teamId === PLAYER_TEAM_ID && event.status === 'scheduled');
  const volunteerNeed = schedule.find((event) => (event.volunteerSpots ?? 0) > 0 && event.status === 'scheduled');
  const pendingRegs = registrations.filter((item) => item.status === 'pending' || item.paymentStatus === 'pending');
  const closedField = schedule.find((event) => event.fieldStatus === 'closed');
  const teamNote = announcements.find((item) => item.teamId === PLAYER_TEAM_ID);
  const parentNote = announcements.find((item) => item.teamId === COACH_TEAM_ID || item.programId === kidsProgramId);
  const parentReg = role === 'guardian' || role === 'admin' ? registrations[0] : undefined;
  const attendance = completedAttendance(mayaAttendanceHistory);
  const missingRsvps = Math.max(0, 12 - (kidsEvent?.goingCount ?? 0));
  const showSeason = canOpenSeasonHub(role, Boolean(parentReg));
  const briefingIds = new Set(
    [
      role === 'guardian' || role === 'coach' ? kidsEvent?.id : undefined,
      role === 'adult_player' ? menEvent?.id : undefined,
      role === 'volunteer' ? volunteerNeed?.id : undefined,
    ].filter(Boolean) as string[],
  );
  const week = schedule.filter((event) => event.status === 'scheduled' && !briefingIds.has(event.id)).slice(0, 3);
  const viewingChild = household.children.find((child) => child.id === childId) ?? household.children[0];
  const gameEvent = role === 'adult_player' ? menEvent : kidsEvent;
  const gameDay = gameEvent && isGameDayWindow(gameEvent) ? gameDayBrief(gameEvent, role === 'guardian' ? viewingChild?.firstName : undefined) : null;
  const conflict = householdConflictStub(role);
  const clubHint = crossClubSuggestion(role, followedIds, schedule);

  const heading =
    role === 'guest'
      ? null
      : role === 'coach'
        ? { kicker: 'COACH DESK', title: 'U8 training today.' }
        : role === 'volunteer'
          ? { kicker: 'VOLUNTEER DESK', title: 'Shifts this week.' }
          : role === 'admin'
            ? { kicker: 'CLUB OPS', title: 'Approvals and fields.' }
            : role === 'adult_player'
              ? { kicker: 'MATCH WEEK', title: `You’re next, ${household.guardianName.split(' ')[0]}.` }
              : { kicker: 'YOUR BRIEFING', title: `Good to see you,${'\n'}${household.guardianName.split(' ')[0]}.` };

  const primary =
    role === 'guest'
      ? { label: 'Register for Fall Soccer', href: `/registration/${kidsProgramId}` }
      : urgent
        ? { label: 'Read urgent alert', href: urgent.route ?? '/notifications' }
        : role === 'coach' && kidsEvent
          ? { label: 'Take attendance', href: `/event/${kidsEvent.id}` }
          : role === 'admin'
            ? { label: 'Open club management', href: '/admin' }
            : role === 'volunteer' && volunteerNeed
              ? { label: 'View volunteer need', href: `/event/${volunteerNeed.id}` }
              : role === 'adult_player' && menEvent
                ? { label: menEvent.attendance ? 'View match details' : 'RSVP for next match', href: `/event/${menEvent.id}` }
                : showSeason && parentReg
                  ? { label: 'Open season hub', href: `/season/${parentReg.id}` }
                  : { label: 'Browse programs', href: '/(tabs)/programs' };

  return (
    <Screen tabScene>
      <AppHeader />
      {role === 'guest' ? (
        <View style={styles.guestIntro}>
          <Text style={styles.kicker}>NOVA ROYALS ATHLETIC CLUB</Text>
          <Text style={textStyles.display}>Play bold.{'\n'}Belong here.</Text>
          <Text style={styles.introCopy}>Building a Family of Sports Lovers across Northern Virginia.</Text>
          <View style={styles.authRow}>
            <Button label="Create account" variant="secondary" onPress={() => router.push('/onboarding')} style={styles.flex} />
            <Button label="Sign in" variant="ghost" onPress={() => router.push('/onboarding?mode=signin')} />
          </View>
        </View>
      ) : (
        <View style={styles.welcomeRow}>
          <View style={styles.flex}>
            <Text style={styles.kicker}>{heading?.kicker}</Text>
            <Text style={textStyles.h1}>{heading?.title}</Text>
          </View>
          <DemoBadge />
        </View>
      )}

      {role !== 'guest' && closedField ? <FieldChangeBanner closed venue={closedField.venue} /> : null}

      {role !== 'guest' && urgent ? (
        <PressableScale onPress={() => router.push((urgent.route ?? '/notifications') as never)} style={styles.urgent}>
          <Ionicons name="warning" size={22} color={colors.white} />
          <View style={styles.flex}>
            <Text style={styles.urgentTitle}>{urgent.title}</Text>
            <Text style={styles.urgentBody}>{urgent.body}</Text>
          </View>
        </PressableScale>
      ) : null}

      {gameDay && role !== 'guest' ? (
        <GameDayCard {...gameDay} locationOptIn={notificationPrefs.locationShare} />
      ) : null}

      {role === 'guardian' && hydrated ? (
        <View style={styles.childSwitch}>
          {household.children.map((child) => (
            <Pressable key={child.id} onPress={() => setChildId(child.id)} style={[styles.childChip, child.id === viewingChild?.id && styles.childChipOn]}>
              <Text style={[styles.childChipText, child.id === viewingChild?.id && styles.childChipOnText]}>{child.firstName}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {conflict ? <Brief title={conflict.title} detail={conflict.detail} href="/(tabs)/schedule" /> : null}
      {clubHint && role !== 'guest' ? <Brief title={clubHint.title} detail={clubHint.detail} href={clubHint.href} /> : null}

      {role === 'guardian' && hydrated ? (
        <View style={styles.briefing}>
          {kidsEvent ? (
            <Brief
              title={`${household.children[0]?.firstName ?? 'Your child'}’s next session`}
              detail={`${formatEventParts(kidsEvent.startsAt).weekday} ${formatEventParts(kidsEvent.startsAt).time} · Field ${fieldStatusLabel(kidsEvent.fieldStatus)}`}
              href={`/event/${kidsEvent.id}`}
            />
          ) : null}
          {parentNote ? <Brief title="From Coach Priya" detail={parentNote.title} href={`/message/${parentNote.id}` as never} /> : null}
          {parentReg ? (
            <Brief
              title="Registration & payment"
              detail={`${parentReg.participantNames.join(', ')} · ${parentReg.status} · ${parentReg.paymentStatus}`}
              href={`/season/${parentReg.id}` as never}
            />
          ) : null}
          <Brief title="Maya’s attendance" detail={`${attendance.attended} of ${attendance.total} sessions · ${attendance.percent}%`} href={'/(tabs)/profile'} />
        </View>
      ) : null}

      {role === 'adult_player' && hydrated ? (
        <View style={styles.briefing}>
          {menEvent ? (
            <Brief
              title="Next match"
              detail={`${formatEventParts(menEvent.startsAt).weekday} ${formatEventParts(menEvent.startsAt).time} · ${menEvent.venue}`}
              href={`/event/${menEvent.id}`}
            />
          ) : null}
          {menEvent ? (
            <Brief
              title={menEvent.attendance ? `Availability · ${menEvent.attendance.replace('_', ' ')}` : 'Availability RSVP needed'}
              detail="Going, maybe, or can’t go — for players on this roster."
              href={`/event/${menEvent.id}`}
            />
          ) : null}
          {teamNote?.teamId === PLAYER_TEAM_ID ? <Brief title="Team announcement" detail={teamNote.title} href={`/message/${teamNote.id}` as never} /> : null}
          <Brief title="Men’s Open 8v8" detail="Fixtures and squad" href="/team/nova-royals-men" />
        </View>
      ) : null}

      {role === 'coach' && hydrated ? (
        <View style={styles.briefing}>
          {kidsEvent ? (
            <Brief
              title="Next U8 session"
              detail={`${formatEventParts(kidsEvent.startsAt).time} · ${kidsEvent.venue} · Field ${fieldStatusLabel(kidsEvent.fieldStatus)}`}
              href={`/event/${kidsEvent.id}`}
            />
          ) : null}
          {kidsEvent ? <Brief title="Take attendance" detail="U8 roster is already loaded for this session. Mark everyone present, then record exceptions." href={`/event/${kidsEvent.id}`} /> : null}
          <Brief title="Missing RSVPs" detail={`${missingRsvps} U8 ${missingRsvps === 1 ? 'family has' : 'families have'} not confirmed availability`} href={`/event/${kidsEvent?.id ?? 'kids-session-1'}`} />
          <Brief title="Send announcement" detail="U8 parents only — not club-wide" href="/admin" />
          <Brief title="Roster" detail="Pending grouping stays in club management" href="/team/nova-royals-kids-u8" />
        </View>
      ) : null}

      {role === 'volunteer' && hydrated ? (
        <View style={styles.briefing}>
          {volunteerNeed ? (
            <Brief title="Upcoming need" detail={`${volunteerNeed.title} · ${volunteerNeed.volunteerSpots} spots`} href={`/event/${volunteerNeed.id}`} />
          ) : null}
          <Brief title="Claimed shifts" detail="None claimed on this device yet" href="/(tabs)/schedule" />
          <Brief title="Club events" detail="Field day and fitness hour this week" href="/(tabs)/schedule" />
        </View>
      ) : null}

      {role === 'admin' && hydrated ? (
        <View style={styles.briefing}>
          <Brief title="Pending registrations" detail={`${pendingRegs.length} pending · ${registrations.length} household ${registrations.length === 1 ? 'record' : 'records'} in this demo`} href="/admin" />
          <Brief title="Payment exceptions" detail="Demo checkouts stay pending until a processor is connected" href="/admin" />
          <Brief
            title="Field status"
            detail={closedField ? `${closedField.venue} closed` : 'All listed fields open'}
            href={closedField ? `/event/${closedField.id}` : '/(tabs)/schedule'}
          />
          <Brief title="Urgent broadcast" detail="Weather and closures reach attending families" href="/admin" />
        </View>
      ) : null}

      <Button label={primary.label} icon="arrow-forward" onPress={() => router.push(primary.href as never)} />

      {role === 'guest' ? (
        <>
          <PressableScale onPress={() => router.push(`/registration/${kidsProgramId}`)} style={styles.heroInvite}>
            <StatusPill label="Registration open" tone="orange" />
            <Text style={styles.heroTitle}>{kidsProgram.title}</Text>
            <Text style={styles.heroSub}>{kidsProgram.audience} · {kidsProgram.dates}</Text>
            <Text style={styles.registerNow}>Register now</Text>
          </PressableScale>
          <Button label="Browse all programs" variant="secondary" onPress={() => router.push('/(tabs)/programs')} style={styles.secondaryCta} />
        </>
      ) : null}

      <SectionHeading title="This Week at ROYALS" href="/(tabs)/schedule" actionLabel="See full schedule" />
      <Text style={styles.communityLead}>Club-wide pulse — not a repeat of your briefing.</Text>
      {week.map((event) => {
        const parts = formatEventParts(event.startsAt);
        return (
          <Link key={event.id} href={`/event/${event.id}`} asChild>
            <PressableScale style={styles.weekRow}>
              <Text style={styles.weekWhen}>{parts.weekday} {parts.time}</Text>
              <Text style={styles.weekTitle}>{event.title}</Text>
              <Text style={styles.muted}>
                {event.goingCount ? `${event.goingCount} playing` : 'Club event'}
                {event.supporterCount != null ? ` · ${event.supporterCount} supporting` : ''}
                {` · Field ${fieldStatusLabel(event.fieldStatus)}`}
              </Text>
              {event.volunteerSpots ? <StatusPill label={`${event.volunteerSpots} volunteer spots`} tone="warning" /> : null}
            </PressableScale>
          </Link>
        );
      })}
    </Screen>
  );
}

function Brief({
  title,
  detail,
  href,
}: {
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <Link href={href as never} asChild>
      <PressableScale style={styles.briefRow}>
        <View style={styles.flex}>
          <Text style={styles.briefTitle}>{title}</Text>
          <Text style={styles.muted}>{detail}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.stone} />
      </PressableScale>
    </Link>
  );
}

const styles = StyleSheet.create({
  guestIntro: { gap: spacing.sm, marginBottom: spacing.lg },
  kicker: { color: colors.orangeDark, fontSize: 11, ...typography.label, letterSpacing: 1.35 },
  introCopy: { maxWidth: 390, color: colors.stone, fontSize: 16, lineHeight: 23, ...typography.body },
  authRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm },
  flex: { flex: 1 },
  welcomeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.lg, gap: spacing.md },
  urgent: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.danger, marginBottom: spacing.lg },
  urgentTitle: { color: colors.white, ...typography.heading },
  urgentBody: { color: colors.white, opacity: 0.9, fontSize: 12, marginTop: 4, ...typography.body },
  briefing: { borderRadius: radius.lg, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg, overflow: 'hidden' },
  briefRow: { minHeight: 72, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  briefTitle: { color: colors.ink, fontSize: 15, ...typography.heading },
  muted: { color: colors.stone, fontSize: 12, lineHeight: 17, marginTop: 2, ...typography.body },
  heroInvite: { marginTop: spacing.lg, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.ink, gap: spacing.sm, ...shadow },
  heroTitle: { color: colors.white, fontSize: 28, ...typography.heading },
  heroSub: { color: colors.sand, ...typography.body },
  registerNow: { color: colors.orange, marginTop: spacing.sm, fontSize: 13, ...typography.label },
  secondaryCta: { marginTop: spacing.sm },
  communityLead: { color: colors.stone, fontSize: 13, marginTop: -spacing.sm, marginBottom: spacing.md, ...typography.body },
  weekRow: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 2 },
  weekWhen: { color: colors.orangeDark, fontSize: 10, ...typography.label },
  weekTitle: { color: colors.ink, fontSize: 15, ...typography.heading },
  childSwitch: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  childChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  childChipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  childChipText: { color: colors.charcoal, fontSize: 12, ...typography.label },
  childChipOnText: { color: colors.white },
});
