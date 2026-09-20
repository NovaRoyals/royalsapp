import { StyleSheet, Text, View } from 'react-native';

import type { SessionHistoryRow } from '@/lib/attendance';
import { colors, spacing, typography } from '@/theme/tokens';

export function SeasonDots({
  history,
  total = 12,
  childName,
}: {
  history: SessionHistoryRow[];
  total?: number;
  childName: string;
}) {
  const past = history.filter((row) => row.status !== 'upcoming');
  const attended = past.filter((row) => row.status === 'present' || row.status === 'late').length;
  const percent = past.length ? Math.round((attended / past.length) * 100) : 0;
  const dots = Array.from({ length: total }, (_, index) => past[index]?.status ?? 'upcoming');

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>{childName.toUpperCase()}’S FALL SEASON</Text>
      <Text style={styles.stat}>{attended} sessions completed · {percent}%</Text>
      <View style={styles.row}>
        {dots.map((status, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              status === 'present' || status === 'late' ? styles.on : status === 'absent' ? styles.miss : styles.off,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  kicker: { color: colors.stone, fontSize: 10, ...typography.label },
  stat: { color: colors.ink, fontSize: 15, ...typography.heading },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.sand },
  on: { backgroundColor: colors.ink },
  miss: { backgroundColor: colors.border },
  off: { backgroundColor: colors.sand },
});
