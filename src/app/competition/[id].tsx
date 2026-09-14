import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Field, Screen, StatusPill } from '@/components/ui';
import { demoCompetitions, demoSchedule } from '@/data/demo';
import { formatEventParts } from '@/lib/datetime';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function generateStaticParams() {
  return demoCompetitions.map((item) => ({ id: item.id }));
}

export default function CompetitionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const competition = demoCompetitions.find((item) => item.id === id) ?? demoCompetitions[0];
  const [tab, setTab] = useState<'overview' | 'fixtures' | 'standings'>('overview');
  const [registering, setRegistering] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fixtures = demoSchedule.filter((event) => event.competitionId === competition.id);

  return (
    <Screen>
      <View style={styles.topbar}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={21} /></Pressable>
        <Text style={styles.topTitle}>Competition</Text>
        <Pressable accessibilityLabel="Share competition" style={styles.back}><Ionicons name="share-outline" size={20} /></Pressable>
      </View>

      <View style={[styles.hero, competition.type === 'tournament' && styles.tournamentHero]}>
        <Ionicons name={competition.type === 'tournament' ? 'trophy-outline' : 'shield-outline'} size={42} color={colors.orange} />
        <StatusPill label={`${competition.type} · ${competition.status.replace('_', ' ')}`} tone="orange" />
        <Text style={styles.title}>{competition.title}</Text>
        <Text style={styles.organizer}>{competition.organizer}</Text>
        <View style={styles.heroMeta}>
          <Meta icon="calendar-outline" value={competition.dates} />
          <Meta icon="location-outline" value={competition.location} />
          <Meta icon="grid-outline" value={competition.format} />
        </View>
      </View>

      {competition.externalDisclaimer ? (
        <View style={styles.disclaimer}><Ionicons name="information-circle-outline" size={19} color={colors.info} /><Text style={styles.disclaimerText}>{competition.externalDisclaimer}</Text></View>
      ) : null}

      <View style={styles.tabs}>
        {(competition.type === 'training' ? (['overview', 'fixtures'] as const) : (['overview', 'fixtures', 'standings'] as const)).map((item) => (
          <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabActive]}>
            <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'overview' && (
        <View>
          <Text style={styles.heading}>Competition details</Text>
          <Text style={styles.body}>{competition.description}</Text>
          <View style={styles.detailCard}>
            <Detail label="Season" value={competition.season} />
            <Detail label="Format" value={competition.format} />
            {competition.eligibility ? <Detail label="Eligibility" value={competition.eligibility} /> : null}
            {competition.entryFee ? <Detail label="Entry fee" value={competition.entryFee} /> : null}
            {competition.registrationDeadline ? <Detail label="Deadline" value={competition.registrationDeadline} last /> : null}
          </View>

          {competition.type === 'tournament' && !registering && !submitted ? (
            <View style={styles.registrationBlock}>
              <Text style={styles.blockTitle}>Bring your team</Text>
              <Text style={styles.body}>Register a team, name a manager and build an eligibility-checked squad.</Text>
              <Button label="Start team registration" icon="arrow-forward" onPress={() => setRegistering(true)} />
            </View>
          ) : null}

          {registering && !submitted ? (
            <View style={styles.teamForm}>
              <Text style={styles.blockTitle}>Team registration</Text>
              <Text style={styles.formNote}>Demo submission · a production entry moves to manager review.</Text>
              <Field label="Team name" placeholder="Your team name" />
              <Field label="Manager full name" placeholder="Authorized contact" />
              <Field label="Manager email" keyboardType="email-address" autoCapitalize="none" />
              <Field label="Manager phone" keyboardType="phone-pad" />
              <Field label="Expected squad size" keyboardType="number-pad" placeholder="12" />
              <View style={styles.rosterPreview}>
                <Ionicons name="people-outline" size={21} color={colors.orangeDark} />
                <Text style={styles.rosterText}>After submission: add players, DOB eligibility, jersey numbers, waivers and check-in status.</Text>
              </View>
              <Button label="Submit demo team" onPress={() => { setSubmitted(true); setRegistering(false); }} />
            </View>
          ) : null}

          {submitted ? (
            <View style={styles.submitted}>
              <Ionicons name="checkmark-circle" size={30} color={colors.success} />
              <View style={styles.flex}><Text style={styles.submittedTitle}>Team entry submitted</Text><Text style={styles.submittedText}>Status: pending manager approval · Demo only</Text></View>
            </View>
          ) : null}

          {competition.bracketReady ? (
            <View style={styles.bracket}>
              <View style={styles.bracketTitleRow}><Ionicons name="git-network-outline" size={20} color={colors.orange} /><Text style={styles.bracketTitle}>Bracket-ready architecture</Text></View>
              <Text style={styles.bracketText}>Groups and knockout rounds share the competition entry and fixture model. Seeded bracket UI can activate after teams are approved.</Text>
            </View>
          ) : null}
        </View>
      )}

      {tab === 'fixtures' && (
        <View style={styles.fixtureList}>
          <Text style={styles.heading}>Fixtures & results</Text>
          {fixtures.length > 0 ? fixtures.map((fixture) => (
            <View key={fixture.id} style={styles.fixture}>
              <View style={styles.fixtureDate}><Text style={styles.fixtureDay}>{formatEventParts(fixture.startsAt).day}</Text><Text style={styles.fixtureMonth}>{formatEventParts(fixture.startsAt).month}</Text></View>
              <View style={styles.flex}><Text style={styles.fixtureTitle}>{fixture.title}</Text><Text style={styles.fixtureMeta}>{fixture.venue} · Demo</Text></View>
              <Text style={styles.fixtureResult}>{fixture.result ?? formatEventParts(fixture.startsAt).time}</Text>
            </View>
          )) : (
            <View style={styles.empty}><Ionicons name="calendar-outline" size={26} color={colors.orange} /><Text style={styles.emptyTitle}>Fixtures publish after registration</Text><Text style={styles.emptyText}>Approved teams, groups and field slots will appear here.</Text></View>
          )}
        </View>
      )}

      {tab === 'standings' && (
        <View>
          <Text style={styles.heading}>{competition.type === 'tournament' ? 'Group standings' : 'League table'}</Text>
          {competition.standings ? (
            <View style={styles.table}>
              <View style={styles.tableHeader}><Text style={[styles.th, styles.teamCol]}>TEAM</Text><Text style={styles.th}>P</Text><Text style={styles.th}>W</Text><Text style={styles.th}>D</Text><Text style={styles.th}>L</Text><Text style={styles.th}>GD</Text><Text style={styles.th}>PTS</Text></View>
              {competition.standings.map((row) => (
                <View key={row.team} style={[styles.tableRow, row.isRoyals && styles.tableRoyals]}>
                  <Text style={styles.rank}>{row.rank}</Text>
                  <Text style={[styles.td, styles.teamCol, row.isRoyals && styles.strong]}>{row.team}</Text>
                  <Text style={styles.td}>{row.played}</Text><Text style={styles.td}>{row.won}</Text><Text style={styles.td}>{row.drawn}</Text><Text style={styles.td}>{row.lost}</Text><Text style={styles.td}>{row.for - row.against}</Text><Text style={[styles.td, styles.strong]}>{row.points}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.empty}><Ionicons name="stats-chart-outline" size={26} color={colors.orange} /><Text style={styles.emptyTitle}>Standings start with play</Text><Text style={styles.emptyText}>Generic standings support sport-specific rules and tie breakers.</Text></View>
          )}
        </View>
      )}
    </Screen>
  );
}

function Meta({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: string }) {
  return <View style={styles.metaRow}><Ionicons name={icon} size={15} color={colors.orange} /><Text style={styles.metaText}>{value}</Text></View>;
}

function Detail({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return <View style={[styles.detail, !last && styles.detailBorder]}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  topbar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.ink, fontSize: 15, ...typography.heading },
  hero: { marginTop: spacing.md, minHeight: 330, borderRadius: radius.lg, padding: spacing.xl, backgroundColor: colors.ink, alignItems: 'flex-start', justifyContent: 'flex-end', gap: spacing.sm },
  tournamentHero: { backgroundColor: '#261A14' },
  title: { color: colors.white, fontSize: 32, lineHeight: 36, ...typography.heading },
  organizer: { color: colors.sand, fontSize: 12, ...typography.body },
  heroMeta: { width: '100%', marginTop: spacing.md, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.charcoal, gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaText: { color: colors.sand, fontSize: 12, ...typography.body },
  disclaimer: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: '#E7F0F5', flexDirection: 'row', gap: spacing.sm },
  disclaimerText: { flex: 1, color: colors.info, fontSize: 11, lineHeight: 17, ...typography.body },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginTop: spacing.xl },
  tab: { flex: 1, paddingVertical: spacing.lg, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.orange },
  tabText: { color: colors.stone, fontSize: 11, textTransform: 'capitalize', ...typography.label },
  tabTextActive: { color: colors.ink },
  heading: { color: colors.ink, fontSize: 22, marginTop: spacing.xxl, marginBottom: spacing.md, ...typography.heading },
  body: { color: colors.stone, fontSize: 14, lineHeight: 21, ...typography.body },
  detailCard: { marginTop: spacing.xl, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.paper },
  detail: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  detailBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { color: colors.stone, fontSize: 11, ...typography.label },
  detailValue: { flex: 1, textAlign: 'right', color: colors.ink, fontSize: 12, ...typography.heading },
  registrationBlock: { marginTop: spacing.xl, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.orangeSoft, gap: spacing.md },
  blockTitle: { color: colors.ink, fontSize: 21, ...typography.heading },
  teamForm: { marginTop: spacing.xl, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.paper },
  formNote: { color: colors.warning, fontSize: 11, marginTop: 4, marginBottom: spacing.xl, ...typography.label },
  rosterPreview: { marginBottom: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.orangeSoft, flexDirection: 'row', gap: spacing.sm },
  rosterText: { flex: 1, color: colors.charcoal, fontSize: 11, lineHeight: 17, ...typography.body },
  submitted: { marginTop: spacing.xl, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.successSoft, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  submittedTitle: { color: colors.success, fontSize: 15, ...typography.heading },
  submittedText: { color: colors.success, fontSize: 11, marginTop: 3, ...typography.body },
  bracket: { marginTop: spacing.xl, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.ink },
  bracketTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bracketTitle: { color: colors.white, fontSize: 14, ...typography.heading },
  bracketText: { color: colors.sand, fontSize: 12, lineHeight: 18, marginTop: spacing.sm, ...typography.body },
  fixtureList: { gap: 0 },
  fixture: { minHeight: 82, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  fixtureDate: { width: 46, height: 52, borderRadius: radius.sm, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  fixtureDay: { color: colors.white, fontSize: 18, ...typography.heading },
  fixtureMonth: { color: colors.orange, fontSize: 8, ...typography.label },
  fixtureTitle: { color: colors.ink, fontSize: 14, ...typography.heading },
  fixtureMeta: { color: colors.stone, fontSize: 10, marginTop: 3, ...typography.body },
  fixtureResult: { maxWidth: 88, color: colors.orangeDark, fontSize: 10, textAlign: 'right', ...typography.label },
  empty: { padding: spacing.xxl, borderRadius: radius.md, backgroundColor: colors.paper, alignItems: 'center' },
  emptyTitle: { color: colors.ink, fontSize: 16, marginTop: spacing.md, ...typography.heading },
  emptyText: { color: colors.stone, fontSize: 12, textAlign: 'center', marginTop: spacing.xs, ...typography.body },
  table: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.paper },
  tableHeader: { minHeight: 40, paddingHorizontal: spacing.sm, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center' },
  tableRow: { minHeight: 48, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  tableRoyals: { backgroundColor: colors.orangeSoft },
  th: { width: 30, color: colors.sand, fontSize: 8, textAlign: 'center', ...typography.label },
  td: { width: 30, color: colors.charcoal, fontSize: 10, textAlign: 'center', ...typography.body },
  rank: { width: 20, color: colors.stone, fontSize: 10, ...typography.label },
  teamCol: { flex: 1, textAlign: 'left' },
  strong: { color: colors.ink, ...typography.label },
  flex: { flex: 1 },
});
