import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CricketMark } from '@/components/icons/CricketMark';
import { PressableScale } from '@/components/motion';
import { Chip } from '@/components/ui';
import { demoPrograms } from '@/data/demo';
import { orderedPrograms, programIsEnrolled, programStatusLine } from '@/lib/homeFeed';
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

export function ClubDirectory({ nowIso }: { nowIso: string }) {
  const { registrations, schedule } = useApp();
  const [sport, setSport] = useState<SportCode>('soccer');
  const [openOnly, setOpenOnly] = useState(false);
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();

  const programs = useMemo(() => {
    const filtered = demoPrograms.filter((program) => {
      if (program.sport !== sport) return false;
      if (openOnly && !program.registrationOpen) return false;
      return true;
    });
    return orderedPrograms(filtered, registrations);
  }, [sport, openOnly, registrations]);

  const twoCol = width >= 640 && programs.length > 1;
  const fade = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      fade.value = 1;
      return;
    }
    fade.value = 0.08;
    fade.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) });
  }, [sport, fade, reduced]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <View>
      <SportSwitch
        value={sport}
        onChange={(next) => {
          if (next === sport) return;
          haptic('light');
          setSport(next);
        }}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
        <View style={styles.chips}>
          <Chip label="All" active={!openOnly} onPress={() => setOpenOnly(false)} />
          <Chip label="Registration open" active={openOnly} onPress={() => setOpenOnly(true)} />
        </View>
      </ScrollView>
      <Animated.View style={[styles.list, twoCol && styles.listGrid, fadeStyle]}>
        {programs.map((program) => {
          const enrolled = programIsEnrolled(program, registrations);
          const status = programStatusLine(program, schedule, nowIso, enrolled);
          return (
            <ProgramCard key={program.id} programId={program.id} title={program.title} audience={program.audience} image={program.heroImage} status={status} wide={twoCol} />
          );
        })}
      </Animated.View>
    </View>
  );
}

function ProgramCard({
  programId,
  title,
  audience,
  image,
  status,
  wide,
}: {
  programId: string;
  title: string;
  audience: string;
  image: string;
  status: string;
  wide: boolean;
}) {
  return (
    <Link href={`/program/${programId}`} asChild>
      <PressableScale style={StyleSheet.flatten([styles.programCard, wide && styles.programTile])}>
        <Image source={{ uri: image }} style={[styles.cardImage, wide && styles.tileImage]} contentFit="cover" />
        <View style={styles.cardBody}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.ink} />
          </View>
          <Text style={styles.audience}>{audience}</Text>
          <Text numberOfLines={2} style={styles.status}>{status}</Text>
        </View>
      </PressableScale>
    </Link>
  );
}

function SportSwitch({ value, onChange }: { value: SportCode; onChange: (sport: SportCode) => void }) {
  const reduced = useReducedMotion();
  const ref = useRef<View>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const root = ref.current as unknown as { querySelectorAll?: (query: string) => Iterable<HTMLElement> } | null;
    if (!root?.querySelectorAll) return;
    for (const node of root.querySelectorAll('[role="tab"]')) {
      const label = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      node.setAttribute('aria-selected', label.endsWith(value === 'soccer' ? 'Soccer' : 'Cricket') ? 'true' : 'false');
    }
  }, [value]);
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
    <View ref={ref} accessibilityRole="tablist" onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.sportSwitch}>
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
  sportSwitch: { flexDirection: 'row', backgroundColor: colors.sand, borderRadius: radius.md, padding: 4, marginBottom: spacing.md, position: 'relative' },
  sportPill: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 11, backgroundColor: colors.ink },
  sportOption: { flex: 1, minHeight: 46, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, zIndex: 1 },
  sportText: { color: colors.stone, fontSize: 14, ...typography.label },
  sportTextActive: { color: colors.white },
  filters: { marginBottom: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm },
  list: { gap: spacing.md },
  listGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  programCard: { flexDirection: 'row', backgroundColor: colors.paper, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  programTile: { width: '48%', flexGrow: 0, flexDirection: 'column', minHeight: 250 },
  cardImage: { width: 112, minHeight: 132, backgroundColor: colors.sand },
  tileImage: { width: '100%', height: 148, minHeight: 148 },
  cardBody: { flex: 1, padding: spacing.md, gap: 4 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  cardTitle: { flex: 1, color: colors.ink, fontSize: 16, ...typography.heading },
  audience: { color: colors.orangeDark, fontSize: 11, ...typography.label, textTransform: 'uppercase' },
  status: { color: colors.stone, fontSize: 13, lineHeight: 18, ...typography.body },
});
