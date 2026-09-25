import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui';
import { safeBack } from '@/lib/nav';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function AccountPersonalScreen() {
  const { household, role } = useApp();
  const name = role === 'guest' ? 'Not signed in' : household.guardianName.trim() || 'No name yet';
  const email = role === 'guest' ? '—' : household.email.trim() || 'No email yet';
  return (
    <Screen>
      <Header title="Personal information" />
      <Row label="Name" value={name} />
      <Row label="Email" value={email} />
      <Row label="Phone" value={household.phone.trim() || 'Add from Profile later'} />
      <Row label="Address" value={household.address.trim() || 'Add when you need travel times'} last />
      <Text style={styles.note}>Change this anytime. Username is optional and lives in Profile later.</Text>
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
      <Text selectable style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 22, ...typography.pageTitle },
  row: { minHeight: 64, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  border: {},
  label: { color: colors.stone, fontSize: 12, ...typography.label },
  value: { color: colors.ink, fontSize: 16, marginTop: 4, ...typography.body },
  note: { color: colors.stone, fontSize: 13, marginTop: 16, ...typography.body },
});
