import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { formatTimeChip } from '@/lib/fields';
import type { LocatedPitch } from '@/lib/pitchCoords';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function BestPickBanner({
  pitch,
  time,
  onPress,
}: {
  pitch: LocatedPitch;
  time: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} style={styles.card}>
      <Text style={styles.star}>★</Text>
      <View style={styles.copy}>
        <Text style={styles.kicker}>★ Best pick for {formatTimeChip(time)}</Text>
        <Text style={styles.name}>{pitch.name}</Text>
        <Text style={styles.sub}>{pitch.pitch}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.white} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    minHeight: 64,
  },
  star: { color: '#e9a13b', fontSize: 22 },
  copy: { flex: 1, gap: 2 },
  kicker: { color: '#e9a13b', fontSize: 11, ...typography.label, textTransform: 'uppercase' },
  name: { color: colors.white, fontSize: 18, ...typography.heading },
  sub: { color: colors.sand, fontSize: 12, ...typography.body },
});
