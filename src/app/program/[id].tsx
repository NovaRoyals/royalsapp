import { Ionicons } from '@expo/vector-icons';
import { Href, Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { CricketMatchesPane } from '@/components/cricket/MatchesPane';
import { SoccerFixturesPane } from '@/components/soccer/FixturesPane';
import { KenBurnsImage } from '@/components/media/KenBurnsImage';
import { CricketMark } from '@/components/icons/CricketMark';
import { Button, Chip, Screen, StatusPill } from '@/components/ui';
import { demoPrograms, demoTeams } from '@/data/demo';
import { FXA } from '@/lib/soccer';
import { track } from '@/lib/analytics';
import { safeBack } from '@/lib/nav';
import { cricketPrivacyName } from '@/lib/cricket';
import { privacyName } from '@/lib/attendance';
import { formatEventParts } from '@/lib/datetime';
import { dollars, joinOffer, offerHeadline } from '@/lib/pricing';
import { useClubNow } from '@/lib/useClubNow';
import { canSeeFullRoster } from '@/lib/membership';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function generateStaticParams() {
  return demoPrograms.map((item) => ({ id: item.id }));
}

export default function ProgramDetailScreen() {
  const { id, pane: paneParam } = useLocalSearchParams<{ id: string; pane?: string }>();
  const { role, schedule } = useApp();
  const program = demoPrograms.find((item) => item.id === id) ?? demoPrograms[0];
  const nowIso = useClubNow();
  const kidsOffer = program.id === 'fall-kids-2026' ? joinOffer(nowIso) : null;
  const kidsPromo = kidsOffer ? offerHeadline(kidsOffer) : null;
  const team = program.teamId ? demoTeams.find((item) => item.id === program.teamId) : undefined;
  // The address is the single source of truth for the tab. A link that asks for About always
  // gets About, even when this screen is already open on Squad.
  const pane: 'about' | 'squad' | 'matches' | 'fixtures' =
    paneParam === 'squad' || paneParam === 'matches' || paneParam === 'fixtures' ? paneParam : 'about';
  const setPane = (next: 'about' | 'squad' | 'matches' | 'fixtures') => router.setParams({ pane: next });
  const isYouth = program.id === 'fall-kids-2026' || program.id === 'travel-soccer';
  const fxaSide = program.id === 'veterans-soccer' ? '35plus' as const : undefined;
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

  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  useEffect(() => {
    track('program_viewed', { programId: program.id });
  }, [program.id]);

  return (
    <Screen contentStyle={styles.page}>
        <View style={styles.hero}>
        <KenBurnsImage uri={program.heroImage} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(21,19,16,0.08)', 'rgba(21,19,16,0.9)']} style={StyleSheet.absoluteFill} />
        <Pressable accessibilityLabel="Go back" onPress={() => safeBack('/?view=club')} style={styles.back}>
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
          {fxaSide ? <Chip label="Fixtures" active={pane === 'fixtures'} onPress={() => setPane('fixtures')} /> : null}
          <Chip label="Squad" active={pane === 'squad'} onPress={() => setPane('squad')} />
          {cricket ? <Chip label="Matches" active={pane === 'matches'} onPress={() => setPane('matches')} /> : null}
        </View>
      ) : null}

      <View style={styles.cta}>
        <View style={styles.flex}>
          <Text style={styles.ctaLabel}>{fxaSide ? 'FXA Sports' : program.registrationOpen ? 'Registration open' : 'Interest list'}</Text>
          <Text style={styles.ctaPrice}>{kidsPromo ? `From ${dollars(kidsOffer!.firstChildCents)} · ${kidsPromo.badge}` : program.priceLabel}</Text>
        </View>
        <Button
          label={fxaSide ? 'Register on FXA Sports' : program.registrationOpen ? 'Register' : 'Join list'}
          icon="arrow-forward"
          onPress={() => {
            if (fxaSide) {
              Linking.openURL(FXA[fxaSide].detailsUrl);
              return;
            }
            router.push(`/registration/${program.id}`);
          }}
        />
      </View>

      {pane === 'matches' && cricket ? (
        <CricketMatchesPane />
      ) : pane === 'fixtures' && fxaSide ? (
        <SoccerFixturesPane side={fxaSide} />
      ) : pane === 'squad' && team ? (
        <View style={styles.squadWrap}>
          <View style={styles.squadMeta}>
            <Text style={styles.sectionTitle}>{team.name}</Text>
            <Text style={styles.body}>{team.competitionName} · {team.memberCount} players</Text>
          </View>
          {next ? (
            <Link href={`/event/${next.id}`} asChild>
              <Pressable accessibilityRole="link" accessibilityLabel={`${next.title}, ${nextParts?.time ?? ''}`} style={styles.nextCard}>
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
            {fxaSide ? (
              <View style={styles.privateRoster}>
                <Ionicons name="lock-closed-outline" size={15} color={colors.stone} />
                <Text style={styles.privateText}>Roster available to registered players on FXA</Text>
              </View>
            ) : squadGroups.map((group) => (
              <View key={group.title}>
                {squadGroups.length > 1 ? <Text style={styles.groupTitle}>{group.title}</Text> : null}
                {group.people.map((person, index) => {
                  const row = (
                    <>
                    <View style={styles.number}><Text style={styles.numberText}>{person.jerseyNumber ?? index + 1}</Text></View>
                    <View style={styles.flex}>
                    <Text style={styles.playerName}>{cricket ? cricketPrivacyName(person, authorized, group.people) : privacyName(person, authorized)}</Text>
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
            {fxaSide ? null : (
          <View style={styles.privateRoster}>
              <Ionicons name="lock-closed-outline" size={15} color={colors.stone} />
              <Text style={styles.privateText}>{authorized ? 'Full names · teammate / parent / staff view' : 'Public view · first name and last initial only'}</Text>
            </View>
            )}
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
        <InfoRow
          icon="wallet-outline"
          label="Price"
          value={kidsOffer ? (kidsPromo ? `${dollars(kidsOffer.firstChildCents)} first child · ${dollars(kidsOffer.siblingCents)} siblings · ${kidsPromo.line}` : `$120 first child · $60 siblings · $10 a Sunday`) : program.priceLabel}
          last
        />
      </View>

      {program.id === 'fall-kids-2026' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What to bring</Text>
          <Text style={styles.body}>Shin guards, water, and a labeled jacket. Sundays 9:00–10:00 AM at Arrowhead Park Field 3A, 5200 Arrowhead Park Drive, Centreville.</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What’s included</Text>
        <View style={[styles.includes, styles.includesCard]}>
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
              : 'Adult registration only asks for player and participation details, with no irrelevant guardian fields.'}
          </Text>
        </View>
      </View>

      <View style={styles.faq}>
        <Text style={styles.sectionTitle}>Good to know</Text>
        {[
          { q: 'Can I save my information?', a: 'Yes. Profiles stay attached to your account so future registrations are much faster.' },
          { q: 'When is my place confirmed?', a: 'The club reviews each registration first, then asks you to pay. You’ll see your status live and get a message at each step.' },
        ].map((item, index) => (
          <Pressable
            key={item.q}
            accessibilityRole="button"
            accessibilityState={{ expanded: faqOpen === index }}
            onPress={() => setFaqOpen(faqOpen === index ? null : index)}
            style={styles.faqItem}
          >
            <View style={styles.faqHead}>
              <Text style={styles.faqQuestion}>{item.q}</Text>
              <Ionicons accessible={false} name={faqOpen === index ? 'chevron-up' : 'chevron-down'} size={18} color={colors.stone} />
            </View>
            {faqOpen === index ? <Text style={styles.faqAnswer}>{item.a}</Text> : null}
          </Pressable>
        ))}
      </View>
        </>
      )}

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
      <View style={styles.infoIcon}><Ionicons accessible={false} name={icon} size={18} color={colors.ink} /></View>
      <View style={styles.flex}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 0 },
  hero: { minHeight: 300, justifyContent: 'space-between', overflow: 'hidden' },
  back: { marginTop: spacing.md, marginLeft: spacing.lg, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  heroCopy: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: 6 },
  title: { color: colors.white, fontSize: 36, lineHeight: 38, ...typography.display },
  audience: { color: colors.sand, fontSize: 12, ...typography.label, letterSpacing: 0.6 },
  paneRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: 12 },
  cricketBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupTitle: { color: colors.stone, fontSize: 10, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 4, ...typography.label, textTransform: 'uppercase' },
  squadWrap: { paddingHorizontal: spacing.lg, marginTop: 12, gap: 10 },
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
  facts: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: 10, borderRadius: 22, backgroundColor: colors.paper, paddingVertical: 14 },
  factsAfterTabs: { marginTop: 10 },
  fact: { flex: 1, paddingHorizontal: spacing.sm, borderRightWidth: 1, borderRightColor: colors.border },
  factLabel: { color: colors.stone, fontSize: 9, textTransform: 'uppercase', textAlign: 'center', ...typography.label },
  factValue: { color: colors.ink, fontSize: 13, textAlign: 'center', marginTop: 4, ...typography.heading },
  section: { paddingHorizontal: spacing.lg, marginTop: 18 },
  sectionTitle: { color: colors.ink, fontSize: 18, marginBottom: 8, ...typography.heading },
  body: { color: colors.stone, fontSize: 14, lineHeight: 21, ...typography.body },
  infoCard: { marginHorizontal: spacing.lg, marginTop: 18, borderRadius: 22, backgroundColor: colors.paper, overflow: 'hidden' },
  infoRow: { paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  infoIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { color: colors.stone, fontSize: 10, textTransform: 'uppercase', ...typography.label },
  infoValue: { color: colors.ink, fontSize: 14, marginTop: 2, ...typography.heading },
  includes: { gap: 10 },
  includesCard: { padding: 14, borderRadius: 22, backgroundColor: colors.paper },
  includeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success },
  includeText: { color: colors.charcoal, fontSize: 14, ...typography.body },
  safetyCard: { marginHorizontal: spacing.lg, marginTop: 18, padding: 14, borderRadius: 22, flexDirection: 'row', gap: spacing.md, backgroundColor: colors.goldSoft },
  safetyTitle: { color: colors.orangeDark, fontSize: 15, ...typography.heading },
  safetyText: { color: colors.charcoal, fontSize: 12, lineHeight: 18, marginTop: 3, ...typography.body },
  faq: { marginHorizontal: spacing.lg, marginTop: 18, marginBottom: spacing.xl },
  faqItem: { paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8, borderRadius: 18, backgroundColor: colors.paper },
  faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  faqAnswer: { color: colors.stone, fontSize: 14, lineHeight: 20, marginTop: 8, ...typography.body },
  faqQuestion: { flex: 1, color: colors.ink, fontSize: 15, ...typography.heading },
  cta: { marginHorizontal: spacing.lg, marginTop: 12, paddingVertical: 12, paddingLeft: 16, paddingRight: 12, borderRadius: 26, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ctaLabel: { color: colors.orange, fontSize: 11, textTransform: 'uppercase', ...typography.label },
  ctaPrice: { color: colors.white, fontSize: 12, marginTop: 4, ...typography.body },
  flex: { flex: 1 },
});
