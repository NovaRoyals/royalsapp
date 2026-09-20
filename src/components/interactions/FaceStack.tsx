import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { useReducedMotion } from '@/lib/reducedMotion';
import { colors, typography } from '@/theme/tokens';

const initials = ['RK', 'AS', 'PS', 'JW', 'NK', 'MR', 'LA', 'TD'];

export function FaceStack({ count, joined }: { count: number; joined?: boolean }) {
  const reduced = useReducedMotion();
  const faces = initials.slice(0, Math.min(5, Math.max(3, Math.min(count, 5))));
  return (
    <View style={styles.row} accessible={false}>
      {faces.map((label, index) => (
        <View key={label} style={[styles.face, { zIndex: faces.length - index, marginLeft: index ? -8 : 0 }]}>
          <Text style={styles.initial}>{label}</Text>
        </View>
      ))}
      {joined ? (
        <Animated.View
          entering={reduced || Platform.OS === 'web' ? undefined : ZoomIn.duration(220)}
          style={[styles.face, styles.you, { marginLeft: -8 }]}
        >
          <Text style={styles.youText}>YOU</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  face: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  you: { backgroundColor: colors.orange },
  initial: { color: colors.white, fontSize: 8, ...typography.label },
  youText: { color: colors.white, fontSize: 7, ...typography.label },
});
