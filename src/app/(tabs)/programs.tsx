import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CricketMark } from '@/components/icons/CricketMark';
import { PressableScale } from '@/components/motion';
import { AppHeader, Chip, Screen, StatusPill, textStyles } from '@/components/ui';
import { demoPrograms, kidsProgramId } from '@/data/demo';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/reducedMotion';
import { useApp } from '@/state/AppProvider';
import { motion } from '@/theme/motion';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { SportCode } from '@/types/domain';

const sports: { id: SportCode; label: string; icon: keyof typeof Ionicons.glyphMap; iconOn: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'soccer', label: 'Soccer', icon: 'football-outline', iconOn: 'football' },
  { id: 'cricket', label: 'Cricket', icon: 'baseball-outline', iconOn: 'baseball' },
];

export default function ProgramsScreen() {
  const { role, household, registrations } = useApp();
  const [sport, setSport] = useState<SportCode>('soccer');
  const [openOnly, setOpenOnly] = useState(false);
  const reduced = useReducedMotion();
  const hideKidsPromo =
    role === 'guardian' &&
    (household.children.length > 0 ||
      registrations.some((item) => item.programId === kidsProgramId && item.status !== 'cancelled'));

  const programs = useMemo(() => {
    return demoPrograms.filter((program) => {
      if (program.sport !== sport) return false;
      if (openOnly && !program.registrationOpen) return false;
      if (hideKidsPromo && program.id === kidsProgramId) return false;
      return true;
    });
  }, [sport, openOnly, hideKidsPromo]);

  const kidsPromo = !hideKidsPromo && sport === 'soccer' ? programs.find((program) => program.id === kidsProgramId) : undefined;
  const list = kidsPromo ? programs.filter((program) => program.id !== kidsProgramId) : programs;
  const { width } = useWindowDimensions();
  const twoCol = width >= 640 && list.length > 1;
  const fade = useSharedValue(1);

  useEffect(() => {
    if (kidsPromo) track('program_viewed', { programId: kidsPromo.id });
  }, [kidsPromo]);

  useEffect(() => {
    if (reduced) {
      fade.value = 1;
      return;
    }
    fade.value = 0.08;
    fade.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) });
  }, [sport, fade, reduced]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const lead = hideKidsPromo
    ? 'Squads live with each program. Open Men’s Soccer or CCPL Cricket for the roster, fixtures, and next session.'
    : 'Youth training, adult soccer, and CCPL cricket — tap a program to join or see the team.';

  return (
    <Screen tabScene>
      <AppHeader eyebrow="Discover" title="Programs" />
      <Text style={styles.lead}>{lead}</Text>
      <SportSwitch
        value={sport}
        onChange={(next) => {
          if (next === sport) return;
          haptic('light');
          setSport(next);
        }}
      />

      <Animated.View style={fadeStyle}>
      {kidsPromo ? (
        <Link href={`/program/${kidsPromo.id}`} asChild>
          <PressableScale style={styles.promo}>
            <Image source={{ uri: kidsPromo.heroImage }} style={styles.promoImage} contentFit="cover" />
            <View style={styles.promoBody}>
              <View style={styles.promoTop}>
                <StatusPill label={kidsPromo.badge ?? 'Program'} tone="neutral" />
                <Text style={styles.promoAudience}>{kidsPromo.audience}</Text>
              </View>
              <Text style={textStyles.h3}>{kidsPromo.title}</Text>
              <Text numberOfLines={2} style={styles.promoSummary}>{kidsPromo.summary}</Text>
              <Text style={styles.promoMeta}>{kidsPromo.dates}</Text>
            </View>
          </PressableScale>
        </Link>
      ) : null}

      <View style={styles.filterRow}>
        <Text style={styles.count}>{list.length} {list.length === 1 ? 'PROGRAM' : 'PROGRAMS'}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chips}>
            <Chip label="All" active={!openOnly} onPress={() => setOpenOnly(false)} />
            <Chip label="Registration open" active={openOnly} onPress={() => setOpenOnly(true)} />
          </View>
        </ScrollView>
      </View>

      <View style={[styles.list, twoCol && styles.listGrid]}>
        {list.map((program) => (
          <Link key={program.id} href={`/program/${program.id}`} asChild>
            <PressableScale style={StyleSheet.flatten([styles.programCard, twoCol && styles.programTile])}>
              <Image source={{ uri: program.heroImage }} style={[styles.cardImage, twoCol && styles.tileImage]} contentFit="cover" />
              <View style={[styles.cardBody, twoCol && styles.tileBody]}>
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle}>{program.title}</Text>
                  <Ionicons name="arrow-forward" size={18} color={colors.ink} />
                </View>
                <Text style={styles.audience}>{program.audience}</Text>
                <Text numberOfLines={twoCol ? 3 : 2} style={styles.cardSummary}>{program.summary}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.price}>{program.id === kidsProgramId ? `${program.priceLabel} · $10/session` : program.priceLabel}</Text>
                  {program.registrationOpen ? <View style={styles.openDot} /> : null}
                </View>
              </View>
            </PressableScale>
          </Link>
        ))}
      </View>

      {sport === 'cricket' && (
        <View style={styles.cricketNote}>
          <CricketMark size={22} color={colors.info} />
          <Text style={styles.cricketText}>Capital Cricket Premier League · Manassas1 T20. Eight league games at Manassas Field 1 and Field 2. Record 3W–2L–1NR. CCPL owns the official table — ROYALS only shows published fixtures and scorecards.</Text>
        </View>
      )}
      </Animated.View>
    </Screen>
  );
}

function SportSwitch({ value, onChange }: { value: SportCode; onChange: (sport: SportCode) => void }) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, sports.findIndex((item) => item.id === value));
  const pill = useSharedValue(index);

  useEffect(() => {
    pill.value = reduced ? index : withTiming(index, { duration: motion.duration.base, easing: Easing.out(Easing.cubic) });
  }, [index, pill, reduced]);

  const pillStyle = useAnimatedStyle(() => {
    const segment = width / sports.length;
    return {
      width: Math.max(segment - 4, 0),
      transform: [{ translateX: pill.value * segment }],
    };
  });

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={styles.sportSwitch}
    >
      <Animated.View pointerEvents="none" style={[styles.sportPill, pillStyle]} />
      {sports.map((item) => {
        const active = value === item.id;
        return (
          <PressableScale
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.id)}
            style={styles.sportOption}
          >
            {item.id === 'cricket' ? (
              <CricketMark size={18} color={active ? colors.white : colors.stone} />
            ) : (
              <Ionicons name={active ? item.iconOn : item.icon} size={19} color={active ? colors.white : colors.stone} />
            )}
            <Text style={[styles.sportText, active && styles.sportTextActive]}>{item.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.stone, fontSize: 16, lineHeight: 23, marginTop: -spacing.md, marginBottom: spacing.xl, ...typography.body },
  sportSwitch: { flexDirection: 'row', backgroundColor: colors.sand, borderRadius: radius.md, padding: 4, marginBottom: spacing.xl, position: 'relative' },
  sportPill: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 11, backgroundColor: colors.ink },
  sportOption: { flex: 1, minHeight: 46, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, zIndex: 1 },
  sportText: { color: colors.stone, fontSize: 14, ...typography.label },
  sportTextActive: { color: colors.white },
  promo: { flexDirection: 'row', backgroundColor: colors.paper, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, minHeight: 118 },
  promoImage: { width: 96, backgroundColor: colors.sand },
  promoBody: { flex: 1, padding: spacing.md, gap: 4 },
  promoTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  promoAudience: { color: colors.stone, fontSize: 11, ...typography.label },
  promoSummary: { color: colors.stone, fontSize: 12, lineHeight: 17, ...typography.body },
  promoMeta: { color: colors.charcoal, fontSize: 11, marginTop: 2, ...typography.label },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.xl, marginBottom: spacing.md },
  count: { color: colors.stone, fontSize: 10, ...typography.label, letterSpacing: 1 },
  chips: { flexDirection: 'row', gap: spacing.sm },
  list: { gap: spacing.md },
  listGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  programCard: { flexDirection: 'row', backgroundColor: colors.paper, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  programTile: { width: '48%', flexGrow: 0, flexDirection: 'column', minHeight: 280 },
  cardImage: { width: 112, minHeight: 154, backgroundColor: colors.sand },
  tileImage: { width: '100%', height: 148, minHeight: 148 },
  cardBody: { flex: 1, padding: spacing.md, gap: 4 },
  tileBody: { minHeight: 132 },
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
