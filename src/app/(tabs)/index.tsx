import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { FieldChangeBanner, GameDayCard } from '@/components/interactions/ContextCards';
import { SeasonDots } from '@/components/interactions/SeasonDots';
import { Roy } from '@/components/mascot';
import { KenBurnsImage } from '@/components/media/KenBurnsImage';
import { PressableScale } from '@/components/motion';
import { AppHeader, Button, Screen } from '@/components/ui';
import { demoPrograms, kidsProgramId } from '@/data/demo';
import { mayaAttendanceHistory } from '@/lib/attendance';
import { formatEventParts, relativeDayLabel } from '@/lib/datetime';
import {
  gameDayBrief,
  householdConflictStub,
  isGameDayWindow,
  upcomingThisWeek,
} from '@/lib/intelligence';
import { COACH_TEAM_ID, PLAYER_TEAM_ID, notificationsForRole } from '@/lib/membership';
import { useReducedMotion } from '@/lib/reducedMotion';
import { useApp } from '@/state/AppProvider';
import { colors, layout, radius, spacing, typography } from '@/theme/tokens';
import type { Tint } from '@/components/onboarding/Pieces';

const TILE_TINT: Record<Tint, { bg: string; fg: string }> = {
  green: { bg: colors.mint, fg: colors.ink },
  blue: { bg: colors.blueSoft, fg: colors.blue },
  teal: { bg: colors.tealSoft, fg: colors.teal },
  amber: { bg: colors.amberSoft, fg: colors.amber },
  rose: { bg: colors.roseSoft, fg: colors.rose },
};

export default function HomeScreen() {
  const { role, household, registrations, schedule, notifications, hydrated, notificationPrefs, persona, pendingStaffRole } = useApp();
  const reduced = useReducedMotion();
  const enter = (delay: number, duration = 360) =>
    Platform.OS === 'web' || reduced ? undefined : FadeInDown.delay(delay).duration(duration);
  const [childId, setChildId] = useState(household.children[0]?.id);
  const kidsProgram = demoPrograms.find((item) => item.id === kidsProgramId)!;
  const unread = notificationsForRole(role, notifications).filter((item) => !item.read);
  const urgent = unread.find((item) => item.urgency === 'urgent');
  const kidsEvent = schedule.find((event) => event.teamId === COACH_TEAM_ID && event.status === 'scheduled');
  const menEvent = schedule.find((event) => event.teamId === PLAYER_TEAM_ID && event.status === 'scheduled');
  const pendingRegs = registrations.filter((item) => item.status === 'pending' || item.paymentStatus === 'pending');
  const closedField = schedule.find((event) => event.fieldStatus === 'closed');
  const parentReg = role === 'guardian' || role === 'admin' ? registrations[0] : undefined;
  const missingRsvps = Math.max(0, 12 - (kidsEvent?.goingCount ?? 0));
  const mayaCheckedIn = kidsEvent?.checkIns?.some((row) => row.personId === 'child-maya' && row.present);
  const week = upcomingThisWeek(schedule);
  const viewingChild = household.children.find((child) => child.id === childId) ?? household.children[0];
  const hasChildren = household.children.length > 0;
  const staffPending = Boolean(pendingStaffRole);
  const firstName = household.guardianName.trim().split(' ')[0];
  const gameEvent =
    role === 'adult_player'
      ? menEvent
      : role === 'coach' || (role === 'guardian' && hasChildren)
        ? kidsEvent
        : undefined;
  const gameDay = gameEvent && isGameDayWindow(gameEvent) ? gameDayBrief(gameEvent, role === 'guardian' ? viewingChild?.firstName : undefined) : null;
  const conflict = householdConflictStub(role, household.children.map((child) => child.firstName));

  const featured =
    (role === 'guardian' && hasChildren && kidsEvent) ||
    (role === 'adult_player' && menEvent) ||
    (role === 'coach' && kidsEvent)
      ? gameEvent ?? kidsEvent ?? menEvent
      : week[0];

  const tiles: { label: string; detail: string; icon: keyof typeof Ionicons.glyphMap; tint: Tint; href: string }[] = [
    { label: 'Programs', detail: 'Find a session', icon: 'grid', tint: 'green', href: '/(tabs)/programs' },
    { label: 'Schedule', detail: 'View upcoming', icon: 'calendar', tint: 'blue', href: '/(tabs)/schedule' },
    { label: 'Teams', detail: 'Your teams', icon: 'shield', tint: 'teal', href: '/(tabs)/teams' },
    {
      label: role === 'guardian' && !hasChildren ? 'Register' : 'Updates',
      detail: role === 'guardian' && !hasChildren ? 'Add a player' : 'News & alerts',
      icon: role === 'guardian' && !hasChildren ? 'person-add' : 'notifications',
      tint: 'amber',
      href: role === 'guardian' && !hasChildren ? `/registration/${kidsProgramId}` : '/notifications',
    },
  ];

  if (role === 'guest') {
    return (
      <Screen tabScene>
        <AppHeader />
        <View style={styles.photoHero}>
          <KenBurnsImage uri={kidsProgram.heroImage} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(15,61,46,0.08)', 'rgba(15,61,46,0.88)']} style={StyleSheet.absoluteFill} />
          <Animated.Text entering={enter(40, 320)} style={styles.heroKicker}>
            REGISTRATION OPEN
          </Animated.Text>
          <Animated.Text entering={enter(120)} style={styles.heroTitle}>
            {kidsProgram.title}
          </Animated.Text>
          <Animated.Text entering={enter(180)} style={styles.heroSub}>
            {kidsProgram.audience} · Sundays · {kidsProgram.priceLabel}
          </Animated.Text>
          <Animated.View entering={enter(280)}>
            <Button label="Register" variant="light" onPress={() => router.push(`/registration/${kidsProgramId}`)} />
          </Animated.View>
        </View>
        <Text style={styles.introCopy}>See schedule, coaches, and what to bring — no account required.</Text>
        <View style={styles.tileGrid}>
          {tiles.slice(0, 4).map((tile) => (
            <Tile key={tile.label} {...tile} />
          ))}
        </View>
        <Button label="Create account or sign in" variant="ghost" onPress={() => router.push('/onboarding')} />
      </Screen>
    );
  }

  return (
    <Screen tabScene contentStyle={styles.home}>
      <View style={styles.top}>
        <View>
          <Text style={styles.mark}>NOVA ROYALS</Text>
          <Text style={styles.hello}>{firstName ? `Good to see you, ${firstName}.` : 'Good to see you.'}</Text>
        </View>
        <Link href={'/notifications' as never} asChild>
          <Pressable accessibilityLabel="Open notifications" style={styles.bell}>
            <Ionicons name="notifications-outline" size={20} color={colors.ink} />
            {unread.length ? <View style={styles.bellDot} /> : null}
          </Pressable>
        </Link>
      </View>

      {role === 'guardian' && hasChildren ? (
        <View style={styles.childSwitch}>
          {household.children.map((child) => (
            <PressableScale key={child.id} onPress={() => setChildId(child.id)} style={[styles.childChip, child.id === viewingChild?.id && styles.childChipOn]}>
              <Text style={[styles.childChipText, child.id === viewingChild?.id && styles.childChipOnText]}>{child.firstName}</Text>
            </PressableScale>
          ))}
        </View>
      ) : null}

      {closedField ? <FieldChangeBanner closed venue={closedField.venue} /> : null}
      {urgent ? (
        <PressableScale onPress={() => router.push((urgent.route ?? '/notifications') as never)} style={styles.urgent}>
          <Ionicons name="warning" size={20} color={colors.white} />
          <View style={styles.flex}>
            <Text style={styles.urgentTitle}>{urgent.title}</Text>
            <Text style={styles.urgentBody}>{urgent.body}</Text>
          </View>
        </PressableScale>
      ) : null}
      {gameDay ? <GameDayCard {...gameDay} locationOptIn={notificationPrefs.locationShare} /> : null}

      {staffPending ? (
        <Brief
          title={`${pendingStaffRole === 'coach' ? 'Coach' : 'Manager'} request submitted`}
          detail="Staff tools stay locked until an admin approves this."
          href="/(tabs)/profile"
        />
      ) : null}
      {role === 'guardian' && !hasChildren ? (
        <Brief title="Register a child" detail="Add your Royal to a program when you’re ready." href={`/registration/${kidsProgramId}`} />
      ) : null}
      {role === 'coach' && kidsEvent ? (
        <Brief title="Take attendance" detail={`${missingRsvps} families still need RSVP`} href={`/event/${kidsEvent.id}`} />
      ) : null}
      {role === 'adult_player' && menEvent && !menEvent.attendance ? (
        <Brief title="RSVP for the next match" detail="Going, maybe, or can’t go" href={`/event/${menEvent.id}`} />
      ) : null}
      {role === 'admin' && hydrated ? (
        <Brief title="Pending registrations" detail={`${pendingRegs.length} waiting on club review`} href="/admin" />
      ) : null}
      {role === 'guardian' && parentReg && parentReg.paymentStatus !== 'paid' ? (
        <Brief title="Payment still pending" detail={`${parentReg.participantNames.join(', ')} · $${parentReg.amountDue}`} href={`/season/${parentReg.id}`} />
      ) : null}
      {conflict ? <Brief title={conflict.title} detail={conflict.detail} href="/(tabs)/schedule" /> : null}

      {featured ? (
        <Link href={`/event/${featured.id}`} asChild>
          <PressableScale style={styles.featured}>
            <View style={styles.featuredDate}>
              <Text style={styles.featuredDow}>{formatEventParts(featured.startsAt).weekday}</Text>
              <Text style={styles.featuredDay}>{new Date(featured.startsAt).getDate()}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.featuredKicker}>UPCOMING</Text>
              <Text style={styles.featuredTitle}>{featured.title}</Text>
              <Text style={styles.featuredMeta}>
                {formatEventParts(featured.startsAt).time}
                {featured.venue ? ` · ${featured.venue}` : ''}
              </Text>
            </View>
            <Roy pose="point" still size={78} />
          </PressableScale>
        </Link>
      ) : null}

      {role === 'guardian' && persona === 'demo' && hydrated ? (
        <Animated.View key={childId} entering={Platform.OS === 'web' || reduced ? undefined : FadeIn.duration(240)} style={styles.seasonCard}>
          <SeasonDots history={mayaAttendanceHistory} childName={viewingChild?.firstName ?? 'Maya'} />
          {mayaCheckedIn ? (
            <Text style={styles.checkedIn}>
              {viewingChild?.firstName} checked in · {kidsEvent ? relativeDayLabel(kidsEvent.startsAt) : 'session'}
            </Text>
          ) : null}
        </Animated.View>
      ) : null}

      <View style={styles.tileGrid}>
        {tiles.map((tile) => (
          <Tile key={tile.label} {...tile} />
        ))}
      </View>
    </Screen>
  );
}

function Tile({
  label,
  detail,
  icon,
  tint,
  href,
}: {
  label: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: Tint;
  href: string;
}) {
  const tone = TILE_TINT[tint];
  return (
    <Link href={href as never} asChild>
      <PressableScale style={styles.tile}>
        <View style={[styles.tileIcon, { backgroundColor: tone.bg }]}>
          <Ionicons name={icon} size={18} color={tone.fg} />
        </View>
        <Text style={styles.tileLabel}>{label}</Text>
        <Text style={styles.tileDetail}>{detail}</Text>
      </PressableScale>
    </Link>
  );
}

function Brief({ title, detail, href }: { title: string; detail: string; href: string }) {
  return (
    <Link href={href as never} asChild>
      <PressableScale style={styles.brief}>
        <View style={styles.flex}>
          <Text style={styles.briefTitle}>{title}</Text>
          <Text style={styles.briefDetail}>{detail}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.stone} />
      </PressableScale>
    </Link>
  );
}

const styles = StyleSheet.create({
  home: { maxWidth: layout.flowWidth, paddingBottom: 28 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 8, marginBottom: 18 },
  mark: { color: colors.ink, fontSize: 11, ...typography.label, letterSpacing: 1.8 },
  hello: { color: colors.ink, fontSize: 26, lineHeight: 30, marginTop: 4, ...typography.display },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.orange,
  },
  flex: { flex: 1 },
  photoHero: {
    minHeight: 240,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 20,
    gap: 8,
    marginBottom: 16,
  },
  heroKicker: { color: colors.mint, fontSize: 11, ...typography.label, letterSpacing: 1.4 },
  heroTitle: { color: colors.white, fontSize: 28, lineHeight: 30, ...typography.display },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 14, ...typography.body },
  introCopy: { color: colors.stone, fontSize: 14, lineHeight: 20, marginBottom: 16, ...typography.body },
  featured: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    paddingRight: 4,
    borderRadius: 20,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  featuredDate: {
    width: 52,
    height: 58,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredDow: { color: colors.mint, fontSize: 9, ...typography.label, letterSpacing: 0.8 },
  featuredDay: { color: colors.white, fontSize: 22, lineHeight: 24, ...typography.display },
  featuredKicker: { color: colors.stone, fontSize: 9, ...typography.label, letterSpacing: 1.2 },
  featuredTitle: { color: colors.ink, fontSize: 15, marginTop: 2, ...typography.heading },
  featuredMeta: { color: colors.stone, fontSize: 12, marginTop: 2, ...typography.body },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '47.5%',
    flexGrow: 1,
    minHeight: 108,
    borderRadius: 20,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  tileIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  tileLabel: { color: colors.ink, fontSize: 15, ...typography.heading },
  tileDetail: { color: colors.stone, fontSize: 12, marginTop: 2, ...typography.body },
  brief: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.paper,
    marginBottom: 10,
  },
  briefTitle: { color: colors.ink, fontSize: 14, ...typography.heading },
  briefDetail: { color: colors.stone, fontSize: 12, marginTop: 2, ...typography.body },
  urgent: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 18, backgroundColor: colors.danger, marginBottom: 10 },
  urgentTitle: { color: colors.white, ...typography.heading },
  urgentBody: { color: colors.white, opacity: 0.9, fontSize: 12, marginTop: 2, ...typography.body },
  seasonCard: { padding: 14, borderRadius: 18, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, marginBottom: 14 },
  checkedIn: { color: colors.ink, fontSize: 13, marginTop: 8, ...typography.heading },
  childSwitch: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  childChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  childChipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  childChipText: { color: colors.charcoal, fontSize: 12, ...typography.label },
  childChipOnText: { color: colors.white },
});
