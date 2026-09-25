import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/tokens';

/** Stable shell used for static HTML and the client's first render. */
export function InkHold() {
  return (
    <View style={styles.veil} accessibilityLabel="ROYALS">
      <Text style={styles.eyebrow}>NOVA</Text>
      <Text style={styles.mark}>ROYALS</Text>
      <Text style={styles.sub}>Athletic Club</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  veil: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { color: colors.mint, fontSize: 11, letterSpacing: 2 },
  mark: { color: colors.white, fontSize: 52, letterSpacing: 2 },
  sub: { color: colors.mint, marginTop: 6, fontSize: 12 },
});
