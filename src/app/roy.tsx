import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Roy, ROY_STATES, type RoyHandle, type RoyState } from '@/components/mascot';
import { Screen, StatusPill } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function RoyLabScreen() {
  const royRef = useRef<RoyHandle>(null);
  const [playing, setPlaying] = useState<RoyState>('idle');
  const [lastCompleted, setLastCompleted] = useState<RoyState | null>(null);

  const trigger = (state: RoyState) => {
    haptic(state === 'celebrate' ? 'success' : 'light');
    setPlaying(state);
    royRef.current?.play(state);
  };

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={21} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.kicker}>DEVELOPMENT · NOT IN TABS</Text>
          <Text style={styles.title}>Roy Lab</Text>
        </View>
        <StatusPill label="Demo" />
      </View>
      <Text style={styles.lead}>
        Isolated mascot preview. Whole-character PNG motion for now; part slots are ready for SVG arms, legs, head,
        tail, eyes, and mouth later. Production screens are unchanged.
      </Text>

      <View style={styles.stage}>
        <Roy
          ref={royRef}
          size={260}
          autoIdle
          onComplete={(state) => {
            setLastCompleted(state);
            if (state !== 'exit') setPlaying('idle');
          }}
        />
      </View>

      <Text style={styles.meta}>
        Playing {playing}
        {lastCompleted ? ` · last finished ${lastCompleted}` : ''}
      </Text>

      <View style={styles.row}>
        {ROY_STATES.map((state) => (
          <Pressable
            key={state}
            accessibilityRole="button"
            accessibilityLabel={`Play ${state}`}
            onPress={() => trigger(state)}
            style={[styles.chip, playing === state && styles.chipOn]}
          >
            <Text style={[styles.chipText, playing === state && styles.chipOnText]}>{state}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  kicker: { color: colors.orangeDark, fontSize: 10, ...typography.label, letterSpacing: 1.1 },
  title: { color: colors.ink, fontSize: 24, ...typography.heading },
  lead: { color: colors.stone, fontSize: 13, lineHeight: 19, marginTop: spacing.sm, marginBottom: spacing.lg, ...typography.body },
  stage: {
    minHeight: 300,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  meta: { color: colors.stone, fontSize: 12, marginBottom: spacing.lg, ...typography.body },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.charcoal, fontSize: 12, ...typography.label },
  chipOnText: { color: colors.white },
});
