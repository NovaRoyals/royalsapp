import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/tokens';

/** Reusable empty-state frame. Artwork is never treated as final production art. */
export function IllustrationFrame({
  title,
  message,
  scene = 'pennant',
}: {
  title: string;
  message: string;
  scene?: 'pennant' | 'field' | 'kit';
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.art} accessibilityLabel={`Temporary ${scene} illustration placeholder`}>
        <View style={[styles.shape, scene === 'field' && styles.field, scene === 'kit' && styles.kit]}>
          <Ionicons
            name={scene === 'kit' ? 'shirt-outline' : scene === 'field' ? 'football-outline' : 'flag-outline'}
            size={28}
            color={colors.orange}
          />
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>TEMPORARY ART</Text>
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  art: { width: 160, height: 120, borderRadius: radius.lg, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  shape: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  field: { borderRadius: radius.md },
  kit: { borderRadius: 18, transform: [{ rotate: '-8deg' }] },
  badge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: colors.warningSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { color: colors.warning, fontSize: 8, ...typography.label },
  title: { color: colors.ink, fontSize: 16, textAlign: 'center', ...typography.heading },
  message: { color: colors.stone, fontSize: 13, lineHeight: 19, textAlign: 'center', ...typography.body },
});
