import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader, Button, DemoBadge, Screen, SectionHeading, StatusPill, textStyles } from '@/components/ui';
import { demoAnnouncements, demoCompetitions, demoPrograms, demoTeams, kidsProgramId } from '@/data/demo';
import { formatEventParts } from '@/lib/datetime';
import { useApp } from '@/state/AppProvider';
import { colors, radius, shadow, spacing, typography } from '@/theme/tokens';

const quickPrograms = [
  { label: 'Kids', icon: 'happy-outline' as const, id: kidsProgramId },
  { label: 'Women', icon: 'woman-outline' as const, id: 'womens-soccer' },
  { label: 'Men', icon: 'man-outline' as const, id: 'mens-soccer' },
  { label: 'Cricket', icon: 'radio-outline' as const, id: 'ccpl-cricket' },
];

export default function HomeScreen() {
  const { role, household, registrations, schedule } = useApp();
  const isGuest = role === 'guest';
  const nextEvent =
    role === 'adult_player' || role === 'coach'
      ? schedule.find((event) => event.status === 'scheduled' && event.teamId === 'nova-royals-men') ??
        schedule.find((event) => event.status === 'scheduled')
      : schedule.find((event) => event.status === 'scheduled');
  const nextParts = nextEvent ? formatEventParts(nextEvent.startsAt) : null;
  const activeRegistration = registrations[0];
  const kidsProgram = demoPrograms[0];
  const tournament = demoCompetitions.find((competition) => competition.type === 'tournament')!;

  return (
    <Screen>
      <AppHeader />
      {isGuest ? (
        <View>
          <View style={styles.guestIntro}>
            <Text style={styles.kicker}>NOVA ROYALS ATHLETIC CLUB</Text>
            <Text style={textStyles.display}>Play bold.{'\n'}Belong here.</Text>
            <Text style={styles.introCopy}>Building a Family of Sports Lovers across Northern Virginia.</Text>
          </View>
          <View style={styles.authRow}>
            <Button label="Create account" onPress={() => router.push('/onboarding')} style={styles.flex} />
            <Button label="Sign in" variant="secondary" onPress={() => router.push('/onboarding?mode=signin')} />
          </View>
        </View>
      ) : (
        <View style={styles.welcomeRow}>
          <View>
            <Text style={styles.kicker}>SUNDAY · SEPTEMBER 13</Text>
            <Text style={textStyles.h1}>Good afternoon,{'\n'}{household.guardianName.split(' ')[0]}.</Text>
          </View>
          <DemoBadge />
        </View>
      )}

      <View style={styles.hero}>
        <Image source={{ uri: kidsProgram.heroImage }} contentFit="cover" style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(21,19,16,0.08)', 'rgba(21,19,16,0.92)']} style={StyleSheet.absoluteFill} />
        <View style={styles.heroTop}>
          <StatusPill label="Registration open" tone="orange" />
          <Text style={styles.heroMeta}>FALL 2026</Text>
        </View>
        <View style={styles.heroBottom}>
          <Text style={styles.heroTitle}>Fall Soccer{'\n'}Training</Text>
          <Text style={styles.heroSubtitle}>Ages 3–16 · 12 sessions · Starts today</Text>
          <Button
            label={isGuest ? 'Register now' : 'Register another child'}
            icon="arrow-forward"
            onPress={() => router.push(`/registration/${kidsProgramId}`)}
            style={styles.heroButton}
          />
        </View>
      </View>

      {!isGuest && (
        <>
          <SectionHeading title="Your family" href="/(tabs)/profile" actionLabel="Manage" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>
            {household.children.map((child, index) => (
              <View key={child.id} style={styles.childCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{child.firstName.slice(0, 1)}</Text>
                </View>
                <View style={styles.childInfo}>
                  <Text style={styles.cardTitle}>{child.firstName}</Text>
                  <Text style={styles.muted}>{index === 0 ? 'Fall Soccer · Confirmed' : 'No active registration'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.stone} />
              </View>
            ))}
          </ScrollView>
        </>
      )}

      <SectionHeading title={isGuest ? 'Find your game' : 'Up next'} href="/(tabs)/schedule" actionLabel="Full schedule" />
      {!isGuest && nextEvent ? (
        <Link href={`/event/${nextEvent.id}`} asChild>
          <Pressable style={styles.nextCard}>
            <View style={styles.dateBlock}>
              <Text style={styles.dateDay}>{nextParts?.day}</Text>
              <Text style={styles.dateMonth}>{nextParts?.month}</Text>
            </View>
            <View style={styles.nextInfo}>
              <Text style={styles.cardTitle}>{nextEvent.title}</Text>
              <Text style={styles.muted}>{nextEvent.subtitle}</Text>
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={15} color={colors.orangeDark} />
                <Text style={styles.detailText}>{nextParts?.time} · {nextEvent.venue}</Text>
              </View>
            </View>
          </Pressable>
        </Link>
      ) : (
        <View style={styles.quickGrid}>
          {quickPrograms.map((item) => (
            <Link key={item.id} href={`/program/${item.id}`} asChild>
              <Pressable style={styles.quickItem}>
                <Ionicons name={item.icon} size={24} color={colors.orange} />
                <Text style={styles.quickLabel}>{item.label}</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      )}

      {!isGuest && activeRegistration && (
        <>
          <SectionHeading title="Registration" />
          <View style={styles.registrationCard}>
            <View style={styles.registrationHeader}>
              <View>
                <Text style={styles.cardTitle}>Fall Soccer Training</Text>
                <Text style={styles.muted}>{activeRegistration.participantNames.join(', ')}</Text>
              </View>
              <StatusPill label={activeRegistration.status} tone="success" />
            </View>
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>
            <Text style={styles.progressText}>You’re all set. Session details are in your schedule.</Text>
          </View>
        </>
      )}

      <SectionHeading title="Around the club" />
      <View style={styles.announcementCard}>
        <View style={styles.announcementIcon}>
          <Ionicons name="megaphone" size={20} color={colors.orange} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{demoAnnouncements[0].title}</Text>
          <Text numberOfLines={2} style={styles.muted}>{demoAnnouncements[0].body}</Text>
          <Text style={styles.scopeLabel}>{demoAnnouncements[0].scopeLabel} · Today</Text>
        </View>
      </View>

      <Link href={`/competition/${tournament.id}`} asChild>
        <Pressable style={styles.tournamentCard}>
          <View style={styles.tournamentCopy}>
            <Text style={styles.tournamentEyebrow}>UPCOMING TOURNAMENT · DEMO</Text>
            <Text style={styles.tournamentTitle}>{tournament.title}</Text>
            <Text style={styles.tournamentMeta}>{tournament.dates} · {tournament.location}</Text>
          </View>
          <Ionicons name="trophy-outline" size={42} color={colors.orange} />
        </Pressable>
      </Link>

      <SectionHeading title="Royals teams" href="/(tabs)/teams" actionLabel="See all" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>
        {demoTeams.map((team) => (
          <Link key={team.id} href={`/team/${team.id}`} asChild>
            <Pressable style={styles.teamTile}>
              <View style={[styles.teamAccent, { backgroundColor: team.accent }]} />
              <Text style={styles.teamCode}>{team.shortName}</Text>
              <Text style={styles.muted}>{team.sport === 'soccer' ? 'Soccer' : 'Cricket'} · {team.season}</Text>
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  guestIntro: { gap: spacing.sm, marginBottom: spacing.lg },
  kicker: { color: colors.orangeDark, fontSize: 11, ...typography.label, letterSpacing: 1.35 },
  introCopy: { maxWidth: 390, color: colors.stone, fontSize: 16, lineHeight: 23, ...typography.body },
  authRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  flex: { flex: 1 },
  welcomeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.xl },
  hero: { minHeight: 410, borderRadius: radius.lg, overflow: 'hidden', padding: spacing.lg, justifyContent: 'space-between', ...shadow },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroMeta: { color: colors.white, fontSize: 11, ...typography.label, letterSpacing: 1.2 },
  heroBottom: { gap: spacing.sm },
  heroTitle: { color: colors.white, fontSize: 40, lineHeight: 41, ...typography.display },
  heroSubtitle: { color: colors.sand, fontSize: 14, ...typography.body },
  heroButton: { alignSelf: 'flex-start', marginTop: spacing.sm },
  horizontal: { gap: spacing.md, paddingRight: spacing.xl },
  childCard: {
    width: 285,
    padding: spacing.lg,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: { width: 45, height: 45, borderRadius: 23, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.orangeDark, fontSize: 18, ...typography.heading },
  childInfo: { flex: 1, gap: 2 },
  cardTitle: { color: colors.ink, fontSize: 16, ...typography.heading },
  muted: { color: colors.stone, fontSize: 13, lineHeight: 18, ...typography.body },
  nextCard: {
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.lg,
  },
  dateBlock: {
    width: 58,
    height: 64,
    backgroundColor: colors.orange,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { color: colors.white, fontSize: 24, lineHeight: 26, ...typography.heading },
  dateMonth: { color: colors.white, fontSize: 10, ...typography.label, letterSpacing: 1 },
  nextInfo: { flex: 1, gap: 3 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  detailText: { color: colors.sand, fontSize: 12, ...typography.body },
  quickGrid: { flexDirection: 'row', gap: spacing.sm },
  quickItem: {
    flex: 1,
    minHeight: 88,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  quickLabel: { color: colors.ink, fontSize: 12, ...typography.label },
  registrationCard: { padding: spacing.lg, backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  registrationHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: colors.sand, marginTop: spacing.lg, overflow: 'hidden' },
  progressFill: { width: '100%', height: '100%', backgroundColor: colors.success },
  progressText: { marginTop: spacing.sm, color: colors.success, fontSize: 12, ...typography.label },
  announcementCard: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.paper, borderRadius: radius.md },
  announcementIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  scopeLabel: { marginTop: spacing.sm, color: colors.orangeDark, fontSize: 10, ...typography.label, textTransform: 'uppercase' },
  tournamentCard: {
    marginTop: spacing.md,
    minHeight: 142,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.inkSoft,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tournamentCopy: { flex: 1, gap: spacing.xs },
  tournamentEyebrow: { color: colors.orange, fontSize: 10, ...typography.label, letterSpacing: 1 },
  tournamentTitle: { color: colors.white, fontSize: 23, ...typography.heading },
  tournamentMeta: { color: colors.sand, fontSize: 12, ...typography.body },
  teamTile: {
    width: 200,
    minHeight: 112,
    overflow: 'hidden',
    padding: spacing.lg,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  teamAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  teamCode: { color: colors.ink, fontSize: 16, marginBottom: spacing.sm, ...typography.display, letterSpacing: 0.5 },
});
