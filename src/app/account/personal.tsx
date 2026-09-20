import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui';
import { safeBack } from '@/lib/nav';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function AccountPersonalScreen() {
  return (
    <Screen>
      <Header title="Personal information" />
      <Row label="Name" value="Jordan Williams" />
      <Row label="Email" value="jordan@example.com" />
      <Row label="Phone" value="(703) 555-0148" />
      <Row label="Address" value="Fairfax, VA" last />
      <Text style={styles.note}>Demo household. Edit is local-only in this prototype.</Text>
    </Screen>
  );
}

export function Header({ title }: { title: string }) {
  return (
    <View style={styles.top}>
      <Pressable accessibilityLabel="Go back" onPress={() => safeBack('/(tabs)/profile')} style={styles.back}><Ionicons name="arrow-back" size={21} /></Pressable>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

export function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.border]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 20, ...typography.display },
  row: { paddingVertical: spacing.lg },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { color: colors.stone, fontSize: 11, ...typography.label },
  value: { color: colors.ink, fontSize: 16, marginTop: 4, ...typography.heading },
  note: { color: colors.stone, marginTop: spacing.lg, ...typography.body },
});
