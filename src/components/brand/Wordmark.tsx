import { StyleSheet, Text, View } from 'react-native';

import { CrownMark } from '@/components/onboarding/Decor';
import { colors, typography } from '@/theme/tokens';

export function Wordmark({
  light = false,
  tagline = false,
}: {
  light?: boolean;
  tagline?: boolean;
}) {
  const ink = light ? colors.white : colors.ink;
  return (
    <View accessible accessibilityLabel="Nova Royals" style={styles.wrap}>
      <CrownMark size={22} color={light ? colors.orange : colors.ink} />
      <Text style={[styles.mark, { color: ink }]}>NOVA ROYALS</Text>
      {tagline ? <Text style={[styles.tag, { color: light ? colors.mintDeep : colors.stone }]}>Athletic Club</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
  mark: { fontSize: 13, letterSpacing: 2.6, fontFamily: typography.numeric.fontFamily },
  tag: { fontSize: 11, letterSpacing: 1.4, fontFamily: typography.label.fontFamily },
});
