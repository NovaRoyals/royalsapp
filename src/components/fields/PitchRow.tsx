import { StyleSheet, Text, View } from 'react-native';

import { PIN_BUSY, PIN_CLEAR, PIN_GOLD } from '@/components/fields/mapTypes';
import { PitchDetail } from '@/components/fields/PitchDetail';
import { PressableScale } from '@/components/motion';
import { collapsedStatus } from '@/lib/fields';
import type { LocatedPitch } from '@/lib/pitchCoords';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function PitchRow({
  pitch,
  time,
  expanded,
  isTopPick,
  onToggle,
}: {
  pitch: LocatedPitch;
  time: string;
  expanded: boolean;
  isTopPick: boolean;
  onToggle: () => void;
}) {
  return (
    <View nativeID={`pitch-${pitch.id}`} style={[styles.card, isTopPick && styles.top, expanded && styles.open]}>
      <PressableScale style={styles.head} onPress={onToggle}>
        <View style={[styles.dot, { backgroundColor: pitch.status === 'no_conflict' ? PIN_CLEAR : PIN_BUSY }]} />
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{pitch.name}</Text>
            {isTopPick ? <Text style={styles.tag}>Top pick</Text> : null}
          </View>
          <Text style={styles.sub}>{pitch.pitch} · {pitch.surface}</Text>
          <Text style={styles.status}>{collapsedStatus(pitch, time)}</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{expanded ? 'Hide' : 'Full day'}</Text>
        </View>
      </PressableScale>
      {expanded ? <View style={styles.detail}><PitchDetail pitch={pitch} time={time} /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  top: { borderColor: PIN_GOLD, borderStyle: 'dashed', borderWidth: 2 },
  open: { borderColor: colors.ink, borderStyle: 'solid' },
  head: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.md, gap: spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 8 },
  body: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1, color: colors.ink, fontSize: 16, ...typography.heading },
  tag: { color: PIN_GOLD, fontSize: 10, ...typography.label, textTransform: 'uppercase' },
  sub: { color: colors.orangeDark, fontSize: 11, ...typography.label, textTransform: 'uppercase' },
  status: { color: colors.stone, fontSize: 13, ...typography.body },
  pill: {
    minHeight: 44,
    minWidth: 72,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { color: colors.ink, fontSize: 11, ...typography.label },
  detail: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});
