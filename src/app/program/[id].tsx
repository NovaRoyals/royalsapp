import { Ionicons } from '@expo/vector-icons';
import { Href, Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { CricketMatchesPane } from '@/components/cricket/MatchesPane';
import { KenBurnsImage } from '@/components/media/KenBurnsImage';
import { CricketMark } from '@/components/icons/CricketMark';
import { Button, Chip, Screen, StatusPill } from '@/components/ui';
import { demoPrograms, demoTeams } from '@/data/demo';
import { track } from '@/lib/analytics';
import { safeBack } from '@/lib/nav';
import { privacyName } from '@/lib/attendance';
import { formatEventParts } from '@/lib/datetime';
import { canSeeFullRoster } from '@/lib/membership';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function generateStaticParams() {
  return demoPrograms.map((item) => ({ id: item.id }));
}

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role, schedule } = useApp();
  const program = demoPrograms.find((item) => item.id === id) ?? demoPrograms[0];
  const team = program.teamId ? demoTeams.find((item) => item.id === program.teamId) : undefined;
  const [pane, setPane] = useState<'about' | 'squad' | 'matches'>('about');
  const isYouth = program.id === 'fall-kids-2026' || program.id === 'travel-soccer';
  const authorized = canSeeFullRoster(role, team?.id);
  const next = team ? schedule.find((event) => event.teamId === team.id && event.status === 'scheduled') : undefined;
  const nextParts = next ? formatEventParts(next.startsAt) : null;
  const cricket = program.sport === 'cricket';
  const batterGroup = team?.roster.filter((person) => (person.position ?? '').includes('Batter')) ?? [];
  const allRoundGroup = team?.roster.filter((person) => (person.position ?? '').includes('All-rounder')) ?? [];
  const squadGroups = cricket && team
    ? [
        { title: 'Batters', people: batterGroup },
        { title: 'All-rounders', people: allRoundGroup },
      ].filter((group) => group.people.length)
    : team
      ? [{ title: 'Squad', people: team.roster }]
      : [];

  useEffect(() => {
    track('program_viewed', { programId: program.id });
  }, [program.id]);

  return (
    <Screen contentStyle={styles.page}>
        <View style={styles.hero}>
        <KenBurnsImage uri={program.heroImage} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(21,19,16,0.08)', 'rgba(21,19,16,0.9)']} style={StyleSheet.absoluteFill} />
        <Pressable accessibilityLabel="Go back" onPress={() => safeBack('/(tabs)/programs')} style={styles.back}>
          <Ionicons name="arrow-back" size={21} color={colors.ink} />
        </Pressable>
        <View style={styles.heroCopy}>
          <StatusPill label={program.badge ?? 'Program'} tone="neutral" />
          {cricket ? (
            <View style={styles.cricketBadge}>
              <CricketMark size={16} color={colors.sand} />
              <Text style={styles.audience}>CCPL T20</Text>
            </View>
          ) : null}
          <Text style={styles.title}>{program.title}</Text>
          <Text style={styles.audience}>{program.audience} · {program.sport.toUpperCase()}</Text>
        </View>
      </View>

      {team ? (
        <View style={styles.paneRow}>
          <Chip label="About" active={pane === 'about'} onPress={() => setPane('about')} />
          <Chip label="Squad" active={pane === 'squad'} onPress={() => setPane('squad')} />
          {cricket ? <Chip label="Matches" active={pane === 'matches'} onPress={() => setPane('matches')} /> : null}
        </View>
      ) : null}

      {pane === 'matches' && cricket ? (
        <CricketMatchesPane />
      ) : pane === 'squad' && team ? (
        <View style={styles.squadWrap}>
          <View style={styles.squadMeta}>
            <Text style={styles.sectionTitle}>{team.name}</Text>
            <Text style={styles.body}>{team.competitionName} · {team.memberCount} players</Text>
          </View>
          {next ? (
            <Link href={`/event/${next.id}`} asChild>
              <Pressable style={styles.nextCard}>
                <View style={styles.nextDate}>
                  <Text style={styles.nextDay}>{nextParts?.day}</Text>
                  <Text style={styles.nextMonth}>{nextParts?.month}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.nextTitle}>{next.title}</Text>
                  <Text style={styles.nextMeta}>{nextParts?.time} · {next.venue}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.stone} />
              </Pressable>
            </Link>
          ) : null}
          <View style={styles.roster}>
            {squadGroups.map((group) => (
              <View key={group.title}>
                {squadGroups.length > 1 ? <Text style={styles.groupTitle}>{group.title}</Text> : null}
                {group.people.map((person, index) => {
                  const row = (
                    <>
                    <View style={styles.number}><Text style={styles.numberText}>{person.jerseyNumber ?? index + 1}</Text></View>
                    <View style={styles.flex}>
                      <Text style={styles.playerName}>{privacyName(person, authorized)}</Text>
                      <Text style={styles.position}>{person.position ?? 'Squad'}</Text>
                    </View>
                    {person.position?.startsWith('Captain') ? <StatusPill label="C" tone="orange" /> : null}
                    {person.position?.startsWith('Vice') ? <StatusPill label="VC" tone="neutral" /> : null}
                    </>
                  );
                  const slug = person.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                  return cricket ? (
                    <Link key={person.id} href={`/cricket/player/${slug}` as Href} asChild>
                      <Pressable style={styles.player}>{row}</Pressable>
                    </Link>
                  ) : (
                    <View key={person.id} style={styles.player}>{row}</View>
                  );
                })}
              </View>
            ))}
            <View style={styles.privateRoster}>
              <Ionicons name="lock-closed-outline" size={15} color={colors.stone} />
              <Text style={styles.privateText}>{authorized ? 'Full names · teammate / parent / staff view' : 'Public view · first name and last initial only'}</Text>
            </View>
          </View>
        </View>
      ) : (
        <>
      <View style={[styles.facts, team ? styles.factsAfterTabs : null]}>
        {program.facts.map((fact) => (
          <View key={fact.label} style={styles.fact}>
            <Text style={styles.factLabel}>{fact.label}</Text>
            <Text style={styles.factValue}>{fact.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>The program</Text>
        <Text style={styles.body}>{program.description}</Text>
      </View>

      <View style={styles.infoCard}>
        <InfoRow icon="calendar-outline" label="Dates" value={program.dates} />
        <InfoRow icon="location-outline" label="Venue" value={program.venue} />
        <InfoRow icon="person-outline" label={cricket ? 'Captain' : 'Coach'} value={program.coachName ?? (team?.coachName ?? 'Club staff')} />
        <InfoRow icon="wallet-outline" label="Price" value={program.id === 'fall-kids-2026' ? `${program.priceLabel} · $10/session across 11 Sundays` : program.priceLabel} last />
      </View>

      {program.id === 'fall-kids-2026' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What to bring</Text>
          <Text style={styles.body}>Shin guards, water, and a labeled jacket. Sundays 9:00–10:00 AM at Arrowhead Park Field 3A, 5200 Arrowhead Park Drive, Centreville.</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What’s included</Text>
        <View style={styles.includes}>
          {program.includes.map((item) => (
            <View key={item} style={styles.includeRow}>
              <View style={styles.check}><Ionicons name="checkmark" size={14} color={colors.white} /></View>
              <Text style={styles.includeText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.safetyCard}>
        <Ionicons name={isYouth ? 'shield-checkmark-outline' : 'people-outline'} size={24} color={colors.orangeDark} />
        <View style={styles.flex}>
          <Text style={styles.safetyTitle}>{isYouth ? 'Built for families' : 'The right form for you'}</Text>
          <Text style={styles.safetyText}>
            {isYouth
              ? 'One guardian account can register and safely manage multiple children without exposing private youth information.'
              : 'Adult registration only asks for player and participation details—no irrelevant guardian fields.'}
          </Text>
        </View>
      </View>

      <View style={styles.faq}>
        <Text style={styles.sectionTitle}>Good to know</Text>
        <Text style={styles.faqQuestion}>Can I save my information?</Text>
        <Text style={styles.body}>Yes. Profiles stay attached to your account so future registrations are much faster.</Text>
        <Text style={styles.faqQuestion}>When is my place confirmed?</Text>
        <Text style={styles.body}>You’ll see a live registration status and receive an update after review and payment.</Text>
      </View>
        </>
      )}

      <View style={styles.cta}>
        <View style={styles.flex}>
          <Text style={styles.ctaLabel}>{program.registrationOpen ? 'Registration open' : 'Interest list'}</Text>
          <Text style={styles.ctaPrice}>{program.priceLabel}</Text>
        </View>
        <Button
          label={program.registrationOpen ? 'Register' : 'Join list'}
          icon="arrow-forward"
          onPress={() => {
            router.push(`/registration/${program.id}`);
          }}
        />
      </View>
    </Screen>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoBorder]}>
      <View style={styles.infoIcon}><Ionicons name={icon} size={19} color={colors.orangeDark} /></View>
      <View style={styles.flex}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 0 },
  hero: { minHeight: 390, justifyContent: 'space-between', overflow: 'hidden' },
  back: { marginTop: spacing.md, marginLeft: spacing.lg, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  heroCopy: { padding: spacing.xl, gap: spacing.sm },
  title: { color: colors.white, fontSize: 38, lineHeight: 41, ...typography.display },
  audience: { color: colors.sand, fontSize: 12, ...typography.label, letterSpacing: 0.6 },
  paneRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, marginTop: spacing.lg },
  cricketBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupTitle: { color: colors.stone, fontSize: 10, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 4, ...typography.label, textTransform: 'uppercase' },
  squadWrap: { paddingHorizontal: spacing.xl, marginTop: spacing.lg, gap: spacing.md },
  squadMeta: { gap: 4 },
  nextCard: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nextDate: { width: 54, height: 62, borderRadius: radius.md, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  nextDay: { color: colors.white, fontSize: 23, ...typography.heading },
  nextMonth: { color: colors.white, fontSize: 9, ...typography.label },
  nextTitle: { color: colors.ink, fontSize: 14, ...typography.heading },
  nextMeta: { color: colors.stone, fontSize: 11, marginVertical: spacing.sm, ...typography.body },
  roster: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.paper },
  player: { minHeight: 64, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  number: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  numberText: { color: colors.orange, fontSize: 12, ...typography.label },
  playerName: { color: colors.ink, fontSize: 14, ...typography.heading },
  position: { color: colors.stone, fontSize: 11, marginTop: 2, ...typography.body },
  privateRoster: { minHeight: 48, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  privateText: { color: colors.stone, fontSize: 10, ...typography.body },
  facts: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: -20, borderRadius: radius.md, backgroundColor: colors.paper, paddingVertical: spacing.lg },
  factsAfterTabs: { marginTop: spacing.md },
  fact: { flex: 1, paddingHorizontal: spacing.sm, borderRightWidth: 1, borderRightColor: colors.border },
  factLabel: { color: colors.stone, fontSize: 9, textTransform: 'uppercase', textAlign: 'center', ...typography.label },
  factValue: { color: colors.ink, fontSize: 13, textAlign: 'center', marginTop: 4, ...typography.heading },
  section: { paddingHorizontal: spacing.xl, marginTop: spacing.xxl },
  sectionTitle: { color: colors.ink, fontSize: 21, marginBottom: spacing.md, ...typography.heading },
  body: { color: colors.stone, fontSize: 15, lineHeight: 23, ...typography.body },
  infoCard: { marginHorizontal: spacing.xl, marginTop: spacing.xxl, borderRadius: radius.md, backgroundColor: colors.paper, overflow: 'hidden' },
  infoRow: { padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { color: colors.stone, fontSize: 10, textTransform: 'uppercase', ...typography.label },
  infoValue: { color: colors.ink, fontSize: 14, marginTop: 2, ...typography.heading },
  includes: { gap: spacing.md },
  includeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success },
  includeText: { color: colors.charcoal, fontSize: 14, ...typography.body },
  safetyCard: { marginHorizontal: spacing.xl, marginTop: spacing.xxl, padding: spacing.lg, borderRadius: radius.md, flexDirection: 'row', gap: spacing.md, backgroundColor: colors.orangeSoft },
  safetyTitle: { color: colors.orangeDark, fontSize: 15, ...typography.heading },
  safetyText: { color: colors.charcoal, fontSize: 12, lineHeight: 18, marginTop: 3, ...typography.body },
  faq: { marginHorizontal: spacing.xl, marginTop: spacing.xxl },
  faqQuestion: { color: colors.ink, fontSize: 15, marginTop: spacing.lg, marginBottom: spacing.xs, ...typography.heading },
  cta: { margin: spacing.xl, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ctaLabel: { color: colors.orange, fontSize: 11, textTransform: 'uppercase', ...typography.label },
  ctaPrice: { color: colors.white, fontSize: 12, marginTop: 4, ...typography.body },
  flex: { flex: 1 },
});
