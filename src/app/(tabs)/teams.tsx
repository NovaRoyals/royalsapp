import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader, DemoBadge, Screen, SectionHeading, StatusPill } from '@/components/ui';
import { demoCompetitions, demoTeams } from '@/data/demo';
import { colors, radius, shadow, spacing, typography } from '@/theme/tokens';

export default function TeamsScreen() {
  const league = demoCompetitions[0];

  return (
    <Screen>
      <AppHeader eyebrow="Squads & competition" title="Teams" />
      <View style={styles.contextRow}>
        <Text style={styles.lead}>Follow your Royals teams, fixtures, squad and season progress.</Text>
        <DemoBadge />
      </View>

      <SectionHeading title="My teams" />
      <View style={styles.list}>
        {demoTeams.map((team, index) => (
          <Link key={team.id} href={`/team/${team.id}`} asChild>
            <Pressable style={styles.teamCard}>
              <View style={[styles.mark, { backgroundColor: team.accent }]}>
                <Text style={styles.markText}>{index === 2 ? 'RC' : index === 1 ? 'RW' : 'RM'}</Text>
              </View>
              <View style={styles.teamCopy}>
                <View style={styles.titleRow}>
                  <Text style={styles.teamName}>{team.name}</Text>
                  {team.managed ? <StatusPill label="Manage" tone="orange" /> : null}
                </View>
                <Text style={styles.competition}>{team.competitionName}</Text>
                <View style={styles.stats}>
                  <Text style={styles.record}>{team.record}</Text>
                  <Text style={styles.dot}>•</Text>
                  <Text style={styles.members}>{team.memberCount} squad members</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.stone} />
            </Pressable>
          </Link>
        ))}
      </View>

      <SectionHeading title="Competition snapshot" />
      <Link href={`/competition/${league.id}`} asChild>
        <Pressable style={styles.standingsCard}>
          <View style={styles.standingsHeader}>
            <View>
              <Text style={styles.eyebrow}>LEAGUE</Text>
              <Text style={styles.standingsTitle}>{league.title}</Text>
            </View>
            <Ionicons name="stats-chart" size={24} color={colors.orange} />
          </View>
          {league.standings?.length ? (
            league.standings.slice(0, 3).map((row) => (
              <View key={row.team} style={[styles.standingRow, row.isRoyals && styles.royalsRow]}>
                <Text style={styles.rank}>{row.rank}</Text>
                <Text style={[styles.standingTeam, row.isRoyals && styles.royalsText]}>{row.team}</Text>
                <Text style={styles.played}>{row.played} P</Text>
                <Text style={[styles.points, row.isRoyals && styles.royalsText]}>{row.points} pts</Text>
              </View>
            ))
          ) : (
            <Text style={styles.standingTeam}>Fixtures are live. Table updates after verified results — no placeholder scores.</Text>
          )}
          <Text style={styles.viewTable}>View fixtures →</Text>
        </Pressable>
      </Link>

      <View style={styles.privacy}>
        <Ionicons name="lock-closed-outline" size={20} color={colors.info} />
        <View style={styles.teamCopy}>
          <Text style={styles.privacyTitle}>Roster privacy built in</Text>
          <Text style={styles.privacyText}>Contact details and minor information are shown only to authorized guardians and team staff.</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  contextRow: { gap: spacing.md, marginTop: -spacing.md },
  lead: { maxWidth: 470, color: colors.stone, fontSize: 16, lineHeight: 23, ...typography.body },
  list: { gap: spacing.md },
  teamCard: {
    minHeight: 116,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadow,
  },
  mark: { width: 58, height: 66, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  markText: { color: colors.white, fontSize: 19, ...typography.display, letterSpacing: 1 },
  teamCopy: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  teamName: { flex: 1, color: colors.ink, fontSize: 17, ...typography.heading },
  competition: { color: colors.stone, fontSize: 12, marginTop: 3, ...typography.body },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: spacing.md },
  record: { color: colors.orangeDark, fontSize: 11, ...typography.label },
  dot: { color: colors.border },
  members: { color: colors.stone, fontSize: 11, ...typography.body },
  standingsCard: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.ink, ...shadow },
  standingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  eyebrow: { color: colors.orange, fontSize: 10, ...typography.label, letterSpacing: 1 },
  standingsTitle: { color: colors.white, fontSize: 20, marginTop: 4, ...typography.heading },
  standingRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, borderTopWidth: 1, borderTopColor: colors.charcoal },
  royalsRow: { backgroundColor: colors.orange, borderTopColor: colors.orange, borderRadius: radius.sm },
  rank: { width: 28, color: colors.sand, fontSize: 12, ...typography.label },
  standingTeam: { flex: 1, color: colors.white, fontSize: 13, ...typography.label },
  played: { width: 40, color: colors.sand, fontSize: 11, ...typography.body },
  points: { width: 48, textAlign: 'right', color: colors.white, fontSize: 11, ...typography.label },
  royalsText: { color: colors.white },
  viewTable: { color: colors.orange, fontSize: 12, marginTop: spacing.lg, ...typography.label },
  privacy: { marginTop: spacing.xxl, padding: spacing.lg, borderRadius: radius.md, backgroundColor: '#E7F0F5', flexDirection: 'row', gap: spacing.md },
  privacyTitle: { color: colors.info, fontSize: 14, ...typography.heading },
  privacyText: { color: colors.info, fontSize: 12, lineHeight: 18, marginTop: 3, ...typography.body },
});
