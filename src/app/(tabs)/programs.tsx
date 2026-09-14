import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { AppHeader, Chip, Screen, StatusPill, textStyles } from '@/components/ui';
import { demoPrograms } from '@/data/demo';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { colors, radius, shadow, spacing, typography } from '@/theme/tokens';
import type { SportCode } from '@/types/domain';

export default function ProgramsScreen() {
  const [sport, setSport] = useState<SportCode>('soccer');
  const programs = useMemo(() => demoPrograms.filter((program) => program.sport === sport), [sport]);
  const featured = programs[0];

  useEffect(() => {
    if (featured) track('program_viewed', { programId: featured.id });
  }, [featured]);

  return (
    <Screen tabScene>
      <AppHeader eyebrow="Discover" title="Programs" />
      <Text style={styles.lead}>A clear path into the club—whether you’re registering a child, joining a team or finding your next game.</Text>
      <View style={styles.sportSwitch}>
        <PressableScale
          onPress={() => {
            if (sport !== 'soccer') haptic('light');
            setSport('soccer');
          }}
          style={[styles.sportOption, sport === 'soccer' && styles.sportActive]}
        >
          <Ionicons name={sport === 'soccer' ? 'football' : 'football-outline'} size={19} color={sport === 'soccer' ? colors.white : colors.stone} />
          <Text style={[styles.sportText, sport === 'soccer' && styles.sportTextActive]}>Soccer</Text>
        </PressableScale>
        <PressableScale
          onPress={() => {
            if (sport !== 'cricket') haptic('light');
            setSport('cricket');
          }}
          style={[styles.sportOption, sport === 'cricket' && styles.sportActive]}
        >
          <Ionicons name={sport === 'cricket' ? 'baseball' : 'baseball-outline'} size={19} color={sport === 'cricket' ? colors.white : colors.stone} />
          <Text style={[styles.sportText, sport === 'cricket' && styles.sportTextActive]}>Cricket</Text>
        </PressableScale>
        <PressableScale
          onPress={() => {
            if (sport !== 'fitness') haptic('light');
            setSport('fitness');
          }}
          style={[styles.sportOption, sport === 'fitness' && styles.sportActive]}
        >
          <Ionicons name={sport === 'fitness' ? 'barbell' : 'barbell-outline'} size={19} color={sport === 'fitness' ? colors.white : colors.stone} />
          <Text style={[styles.sportText, sport === 'fitness' && styles.sportTextActive]}>Fitness</Text>
        </PressableScale>
      </View>

      {featured ? (
        <Link href={`/program/${featured.id}`} asChild>
          <PressableScale style={styles.featured}>
            <Image source={{ uri: featured.heroImage }} style={styles.featuredImage} contentFit="cover" />
            <View style={styles.featuredBody}>
              <View style={styles.featuredTop}>
                <StatusPill label={featured.badge ?? 'Program'} tone={featured.registrationOpen ? 'orange' : 'neutral'} />
                <Text style={styles.featuredAudience}>{featured.audience}</Text>
              </View>
              <Text style={textStyles.h2}>{featured.title}</Text>
              <Text style={styles.summary}>{featured.summary}</Text>
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.orangeDark} />
                <Text style={styles.meta}>{featured.dates}</Text>
              </View>
            </View>
          </PressableScale>
        </Link>
      ) : null}

      <View style={styles.filterRow}>
        <Text style={styles.count}>{programs.length} {programs.length === 1 ? 'PROGRAM' : 'PROGRAMS'}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chips}>
            <Chip label="All" active />
            <Chip label="Registration open" />
          </View>
        </ScrollView>
      </View>

      <View style={styles.list}>
        {programs.slice(1).map((program) => (
          <Link key={program.id} href={`/program/${program.id}`} asChild>
            <PressableScale style={styles.programCard}>
              <Image source={{ uri: program.heroImage }} style={styles.cardImage} contentFit="cover" />
              <View style={styles.cardBody}>
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle}>{program.title}</Text>
                  <Ionicons name="arrow-forward" size={18} color={colors.orange} />
                </View>
                <Text style={styles.audience}>{program.audience}</Text>
                <Text numberOfLines={2} style={styles.cardSummary}>{program.summary}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.price}>{program.priceLabel}</Text>
                  {program.registrationOpen ? <View style={styles.openDot} /> : null}
                </View>
              </View>
            </PressableScale>
          </Link>
        ))}
      </View>

      {sport === 'cricket' && (
        <View style={styles.cricketNote}>
          <Ionicons name="information-circle-outline" size={22} color={colors.info} />
          <Text style={styles.cricketText}>Cricket uses the same Royals team and schedule model. CCPL is an external competition — ROYALS does not invent official tables.</Text>
        </View>
      )}
      {sport === 'fitness' && (
        <View style={styles.cricketNote}>
          <Ionicons name="information-circle-outline" size={22} color={colors.info} />
          <Text style={styles.cricketText}>Fitness is a club pillar, not a league. No standings — just sessions, RSVP and community.</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.stone, fontSize: 16, lineHeight: 23, marginTop: -spacing.md, marginBottom: spacing.xl, ...typography.body },
  sportSwitch: { flexDirection: 'row', backgroundColor: colors.sand, borderRadius: radius.md, padding: 4, marginBottom: spacing.xl },
  sportOption: { flex: 1, minHeight: 46, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  sportActive: { backgroundColor: colors.ink },
  sportText: { color: colors.stone, fontSize: 14, ...typography.label },
  sportTextActive: { color: colors.white },
  featured: { backgroundColor: colors.paper, borderRadius: radius.lg, overflow: 'hidden', ...shadow },
  featuredImage: { width: '100%', height: 210, backgroundColor: colors.sand },
  featuredBody: { padding: spacing.lg, gap: spacing.sm },
  featuredTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featuredAudience: { color: colors.stone, fontSize: 12, ...typography.label },
  summary: { color: colors.stone, fontSize: 14, lineHeight: 20, ...typography.body },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
  meta: { color: colors.charcoal, fontSize: 13, ...typography.label },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.xxl, marginBottom: spacing.md },
  count: { color: colors.stone, fontSize: 10, ...typography.label, letterSpacing: 1 },
  chips: { flexDirection: 'row', gap: spacing.sm },
  list: { gap: spacing.md },
  programCard: { flexDirection: 'row', backgroundColor: colors.paper, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  cardImage: { width: 112, minHeight: 154, backgroundColor: colors.sand },
  cardBody: { flex: 1, padding: spacing.md, gap: 4 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  cardTitle: { flex: 1, color: colors.ink, fontSize: 16, ...typography.heading },
  audience: { color: colors.orangeDark, fontSize: 11, ...typography.label, textTransform: 'uppercase' },
  cardSummary: { color: colors.stone, fontSize: 12, lineHeight: 17, ...typography.body },
  cardFooter: { marginTop: 'auto', paddingTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  price: { color: colors.charcoal, fontSize: 11, ...typography.label },
  openDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  cricketNote: { marginTop: spacing.xl, flexDirection: 'row', gap: spacing.md, backgroundColor: '#E7F0F5', borderRadius: radius.md, padding: spacing.lg },
  cricketText: { flex: 1, color: colors.info, fontSize: 13, lineHeight: 19, ...typography.body },
});
