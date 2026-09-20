import { Ionicons } from '@expo/vector-icons';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Screen, SectionHeading, StatusPill } from '@/components/ui';
import { demoTeams } from '@/data/demo';
import { privacyName } from '@/lib/attendance';
import { formatEventParts } from '@/lib/datetime';
import { canSeeFullRoster } from '@/lib/membership';
import { safeBack } from '@/lib/nav';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function generateStaticParams() {
  return demoTeams.map((item) => ({ id: item.id }));
}

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { schedule, announcements, role } = useApp();
  const team = demoTeams.find((item) => item.id === id) ?? demoTeams[0];
  const next = schedule.find((event) => event.teamId === team.id && event.status === 'scheduled');
  const recent = schedule.find((event) => event.teamId === team.id && event.status === 'completed');
  const nextParts = next ? formatEventParts(next.startsAt) : null;
  const teamNote = announcements.find((item) => item.teamId === team.id);
  const authorized = canSeeFullRoster(role, team.id);

  return (
    <Screen>
      <View style={styles.topbar}>
        <Pressable accessibilityLabel="Go back" onPress={() => safeBack('/(tabs)/programs')} style={styles.back}><Ionicons name="arrow-back" size={21} /></Pressable>
        <Text style={styles.topTitle}>Team</Text>
        <Pressable accessibilityLabel="Team options" style={styles.back}><Ionicons name="ellipsis-horizontal" size={21} /></Pressable>
      </View>
      <View style={styles.hero}>
        <View style={[styles.mark, { backgroundColor: team.accent }]}><Text style={styles.markText}>{team.shortName.split(' ').pop()}</Text></View>
        <Text style={styles.name}>{team.name}</Text>
        <Text style={styles.meta}>{team.competitionName} · {team.season}</Text>
        <View style={styles.heroStats}>
          <View><Text style={styles.statValue}>{team.record}</Text><Text style={styles.statLabel}>{team.id === 'nova-royals-men' ? 'FORMAT' : 'RECORD'}</Text></View>
          <View style={styles.statRule} />
          <View><Text style={styles.statValue}>{team.memberCount}</Text><Text style={styles.statLabel}>SQUAD</Text></View>
          <View style={styles.statRule} />
          <View><Text style={styles.statValue}>{team.id === 'nova-royals-kids-u8' || team.id === 'nova-royals-men' ? '—' : team.record}</Text><Text style={styles.statLabel}>{team.id === 'nova-royals-kids-u8' ? 'TRAINING' : team.id === 'nova-royals-men' ? 'TABLE' : 'RECORD'}</Text></View>
        </View>
      </View>

      <View style={styles.actions}>
        <Button label="Schedule" icon="calendar-outline" variant="secondary" style={styles.flex} onPress={() => router.push('/(tabs)/schedule')} />
        <Button label="Announcement" icon="megaphone-outline" variant="secondary" style={styles.flex} onPress={() => router.push((teamNote ? `/message/${teamNote.id}` : '/(tabs)/schedule') as never)} />
      </View>

      {next && (
        <>
          <SectionHeading title={team.id === 'nova-royals-kids-u8' ? 'Next session' : 'Next game'} />
          <Link href={`/event/${next.id}`} asChild>
            <Pressable style={styles.nextCard}>
              <View style={styles.nextDate}><Text style={styles.nextDay}>{nextParts?.day}</Text><Text style={styles.nextMonth}>{nextParts?.month}</Text></View>
              <View style={styles.flex}>
                <Text style={styles.nextTitle}>{next.title}</Text>
                <Text style={styles.nextMeta}>{nextParts?.time} · {next.venue}</Text>
                {role === 'guardian' || role === 'adult_player' ? (
                  <StatusPill label={next.attendance ? `RSVP · ${next.attendance.replace('_', ' ')}` : 'Respond'} tone="warning" />
                ) : (
                  <StatusPill label={`${next.goingCount ?? 0} going`} tone="neutral" />
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.stone} />
            </Pressable>
          </Link>
        </>
      )}

      {recent && (
        <>
          <SectionHeading title="Recent result" />
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>FINAL · DEMO</Text>
            <Text style={styles.result}>{recent.result}</Text>
            <Text style={styles.resultMeta}>{recent.subtitle}</Text>
          </View>
        </>
      )}

      <SectionHeading title="Squad" actionLabel={`${team.memberCount} members`} href={`/team/${team.id}`} />
      <View style={styles.roster}>
        {team.roster.map((person, index) => (
          <View key={person.id} style={styles.player}>
            <View style={styles.number}><Text style={styles.numberText}>{person.jerseyNumber ?? index + 1}</Text></View>
            <View style={styles.flex}>
              <Text style={styles.playerName}>{privacyName(person, authorized)}</Text>
              <Text style={styles.position}>{person.position ?? 'Squad'}</Text>
            </View>
            {team.managed ? <Ionicons name="checkmark-circle" size={19} color={colors.success} /> : null}
          </View>
        ))}
        <View style={styles.privateRoster}><Ionicons name="lock-closed-outline" size={15} color={colors.stone} /><Text style={styles.privateText}>{authorized ? 'Full names · teammate / parent / staff view' : 'Public view · first name and last initial only'}</Text></View>
      </View>

      {teamNote ? (
        <>
          <SectionHeading title="Team update" />
          <Pressable onPress={() => router.push(`/message/${teamNote.id}` as never)} style={styles.announcement}>
            <Ionicons name="megaphone-outline" size={22} color={colors.orangeDark} />
            <View style={styles.flex}><Text style={styles.announcementTitle}>{teamNote.title}</Text><Text style={styles.announcementBody}>{teamNote.body}</Text></View>
          </Pressable>
        </>
      ) : (
        <>
          <SectionHeading title="Team update" />
          <View style={styles.announcement}>
            <Ionicons name="megaphone-outline" size={22} color={colors.orangeDark} />
            <View style={styles.flex}><Text style={styles.announcementTitle}>No team-only update yet</Text><Text style={styles.announcementBody}>Club-wide notes stay on Home and Notifications, marked Club-wide.</Text></View>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topbar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.ink, fontSize: 15, ...typography.heading },
  hero: { marginTop: spacing.md, padding: spacing.xl, borderRadius: radius.lg, alignItems: 'center', backgroundColor: colors.ink },
  mark: { width: 74, height: 82, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  markText: { color: colors.white, fontSize: 23, ...typography.display },
  name: { color: colors.white, fontSize: 27, marginTop: spacing.lg, ...typography.heading },
  meta: { color: colors.sand, fontSize: 12, marginTop: 5, textAlign: 'center', ...typography.body },
  heroStats: { width: '100%', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.charcoal },
  statValue: { color: colors.white, fontSize: 16, textAlign: 'center', ...typography.heading },
  statLabel: { color: colors.stone, fontSize: 8, marginTop: 3, ...typography.label, letterSpacing: 1 },
  statRule: { width: 1, height: 26, backgroundColor: colors.charcoal },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  flex: { flex: 1 },
  nextCard: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nextDate: { width: 54, height: 62, borderRadius: radius.md, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  nextDay: { color: colors.white, fontSize: 23, ...typography.heading },
  nextMonth: { color: colors.white, fontSize: 9, ...typography.label },
  nextTitle: { color: colors.ink, fontSize: 14, ...typography.heading },
  nextMeta: { color: colors.stone, fontSize: 11, marginVertical: spacing.sm, ...typography.body },
  resultCard: { padding: spacing.xl, borderRadius: radius.md, backgroundColor: colors.orangeSoft, alignItems: 'center' },
  resultLabel: { color: colors.orangeDark, fontSize: 9, ...typography.label, letterSpacing: 1 },
  result: { color: colors.ink, fontSize: 22, marginTop: spacing.sm, ...typography.heading },
  resultMeta: { color: colors.stone, fontSize: 11, marginTop: 4, ...typography.body },
  roster: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.paper },
  player: { minHeight: 64, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  number: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  numberText: { color: colors.orange, fontSize: 12, ...typography.label },
  playerName: { color: colors.ink, fontSize: 14, ...typography.heading },
  position: { color: colors.stone, fontSize: 11, marginTop: 2, ...typography.body },
  privateRoster: { minHeight: 48, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  privateText: { color: colors.stone, fontSize: 10, ...typography.body },
  announcement: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.paper, flexDirection: 'row', gap: spacing.md },
  announcementTitle: { color: colors.ink, fontSize: 14, ...typography.heading },
  announcementBody: { color: colors.stone, fontSize: 12, lineHeight: 18, marginTop: 4, ...typography.body },
});
