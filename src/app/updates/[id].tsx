import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui';
import { KIND_LABEL, parentUpdatesFor } from '@/lib/coachRecap';
import { formatEventWhen } from '@/lib/datetime';
import { safeBack } from '@/lib/nav';
import { useApp } from '@/state/AppProvider';
import { colors, spacing, typography } from '@/theme/tokens';

export function generateStaticParams() {
  return [
    { id: 'update-recap-kids-2026-09-20' },
    { id: 'update-note-kids-2026-09-20-child-maya' },
    { id: 'update-note-kids-2026-09-20-u8-jl' },
  ];
}

export default function CoachUpdateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role, household, coachUpdates } = useApp();
  const childIds = household.children.map((child) => child.id);
  const allowed = role === 'admin' ? coachUpdates : parentUpdatesFor(coachUpdates, childIds);
  const item = allowed.find((row) => row.id === id);

  return (
    <Screen>
      <View style={styles.topbar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => safeBack('/(tabs)')} style={styles.back}>
          <Ionicons name="arrow-back" size={21} />
        </Pressable>
        <Text style={styles.topTitle}>Coach update</Text>
        <View style={{ width: 44, height: 44 }} />
      </View>
      {!item ? (
        <Text style={styles.empty}>This update isn’t available on this account.</Text>
      ) : (
        <View style={styles.body}>
          <Text style={styles.kind}>{KIND_LABEL[item.kind].toUpperCase()}</Text>
          {item.childFirstName ? <Text style={styles.about}>Private note about {item.childFirstName}</Text> : null}
          <Text selectable style={styles.copy}>
            {item.body}
          </Text>
          <Text style={styles.meta}>Sent by {item.coachName}</Text>
          <Text style={styles.meta}>{item.sessionTitle}</Text>
          <Text style={styles.meta}>{formatEventWhen(item.sessionStartsAt)}</Text>
          <Text style={styles.meta}>{formatEventWhen(item.sentAt)}</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topbar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.ink, fontSize: 15, ...typography.heading },
  empty: { color: colors.stone, fontSize: 16, marginTop: spacing.xxl, ...typography.body },
  body: { marginTop: spacing.xxl, gap: spacing.sm },
  kind: { color: colors.inkSoft, fontSize: 11, ...typography.label, letterSpacing: 1.2 },
  about: { color: colors.ink, fontSize: 20, ...typography.heading },
  copy: { color: colors.ink, fontSize: 18, lineHeight: 28, marginTop: spacing.md, ...typography.body },
  meta: { color: colors.stone, fontSize: 14, ...typography.body },
});
