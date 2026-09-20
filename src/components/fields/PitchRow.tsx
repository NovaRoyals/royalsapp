import { StyleSheet, Text, View } from 'react-native';

import { PIN_BUSY, PIN_CLEAR, PIN_GOLD } from '@/components/fields/mapTypes';
import { PitchDetail } from '@/components/fields/PitchDetail';
import { PressableScale } from '@/components/motion';
import { collapsedStatus, compactPitchMark } from '@/lib/fields';
import type { LocatedPitch } from '@/lib/pitchCoords';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function PitchRow({
  pitch,
  time,
  expanded,
  isTopPick,
  twoCol,
  onToggle,
}: {
  pitch: LocatedPitch;
  time: string;
  expanded: boolean;
  isTopPick: boolean;
  twoCol?: boolean;
  onToggle: () => void;
}) {
  return (
    <View
      nativeID={`pitch-${pitch.id}`}
      style={[
        styles.card,
        twoCol && styles.half,
        twoCol && expanded && styles.span,
        isTopPick && styles.top,
        expanded && styles.open,
      ]}
    >
      {isTopPick ? <Text style={styles.tag}>Top pick</Text> : null}
      <PressableScale style={[styles.head, isTopPick && styles.headTop]} onPress={onToggle}>
        <View style={[styles.dot, { backgroundColor: pitch.status === 'no_conflict' ? PIN_CLEAR : PIN_BUSY }]} />
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{pitch.name}</Text>
            <Text style={styles.mark}>{compactPitchMark(pitch)}</Text>
          </View>
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
  half: { width: '48%', flexGrow: 1 },
  span: { width: '100%', flexGrow: 1 },
  top: { borderColor: PIN_GOLD, borderStyle: 'dashed', borderWidth: 2 },
  open: { borderColor: colors.ink, borderStyle: 'solid' },
  tag: {
    color: PIN_GOLD,
    fontSize: 10,
    paddingTop: 8,
    paddingHorizontal: spacing.md,
    ...typography.label,
    textTransform: 'uppercase',
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, paddingHorizontal: spacing.md, gap: spacing.sm },
  headTop: { paddingTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  body: { flex: 1, gap: 2, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  name: { flex: 1, color: colors.ink, fontSize: 15, ...typography.heading },
  mark: { color: colors.orangeDark, fontSize: 11, ...typography.label, textTransform: 'uppercase', flexShrink: 0 },
  status: { color: colors.stone, fontSize: 12, ...typography.body },
  pill: {
    minHeight: 36,
    minWidth: 64,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { color: colors.ink, fontSize: 11, ...typography.label },
  detail: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});
