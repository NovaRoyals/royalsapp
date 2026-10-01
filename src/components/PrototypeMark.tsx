import { Platform, StyleSheet, Text, View } from 'react-native';

import { isDemoMode } from '@/lib/supabase';
import { colors, typography } from '@/theme/tokens';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 82 : 64;

/** Unobtrusive prototype marker — not a claim that data is saved to a server. */
export function PrototypeMark({ aboveTabs = false }: { aboveTabs?: boolean }) {
  if (!isDemoMode) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: aboveTabs ? TAB_BAR_HEIGHT + 6 : 4 }]}>
      <Text style={styles.text}>Prototype</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 8,
    zIndex: 40,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 61, 46, 0.08)',
  },
  text: { color: colors.stone, fontSize: 10, letterSpacing: 0.6, fontFamily: typography.label.fontFamily },
});
