import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState, Screen } from '@/components/ui';
import { KIND_LABEL, parentUpdatesFor } from '@/lib/coachRecap';
import { formatEventWhen } from '@/lib/datetime';
import { hydrateTrace } from '@/lib/hydrateTrace';
import { safeBack } from '@/lib/nav';
import { useApp } from '@/state/AppProvider';
import { colors, spacing, typography } from '@/theme/tokens';
import type { CoachUpdate } from '@/types/domain';

const COLLAPSE_AT = 160;

export default function CoachUpdatesScreen() {
  const { role, household, coachUpdates, hasHydrated } = useApp();
  const childIds = household.children.map((child) => child.id);
  const items = role === 'admin' ? coachUpdates : parentUpdatesFor(coachUpdates, childIds);
  hydrateTrace('CoachUpdatesScreen', {
    hasHydrated,
    role,
    itemCount: items.length,
  });

  return (
    <Screen>
      <View style={styles.topbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => safeBack('/(tabs)')}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={21} />
        </Pressable>
        <Text style={styles.topTitle}>Coach updates</Text>
        <View style={{ width: 44, height: 44 }} />
      </View>
      <Text style={styles.lead}>Notes from training — encouraging, specific, and only about your child when a private note is included.</Text>
      {!items.length ? (
        <EmptyState pose="lookRight" title="No coach updates yet" message="After a session, families get a recap when the coach chooses to send it." />
      ) : (
        items.map((item) => <UpdateRow key={item.id} item={item} />)
      )}
    </Screen>
  );
}

function UpdateRow({ item }: { item: CoachUpdate }) {
  const long = item.body.trim().length > COLLAPSE_AT;
  const [open, setOpen] = useState(!long);

  return (
    <View style={styles.row}>
      <Text style={styles.kind}>{KIND_LABEL[item.kind].toUpperCase()}</Text>
      <Text selectable style={styles.body}>
        {open ? item.body : `${item.body.trim().slice(0, COLLAPSE_AT).trim()}…`}
      </Text>
      {long ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? 'Show less' : 'Read more'}
          onPress={() => setOpen((value) => !value)}
          style={styles.more}
        >
          <Text style={styles.moreText}>{open ? 'Show less' : 'Read more'}</Text>
        </Pressable>
      ) : null}
      <Text style={styles.meta}>
        {item.childFirstName ? `About ${item.childFirstName} · ` : ''}
        Sent by {item.coachName} · {item.sessionTitle} · {formatEventWhen(item.sessionStartsAt)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open full update"
        onPress={() => router.push(`/updates/${item.id}` as never)}
        style={styles.more}
      >
        <Text style={styles.moreText}>Open full update</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.ink, fontSize: 15, ...typography.heading },
  lead: { color: colors.stone, fontSize: 15, lineHeight: 22, marginTop: spacing.lg, ...typography.body },
  empty: { color: colors.charcoal, fontSize: 16, lineHeight: 24, marginTop: spacing.xxl, ...typography.body },
  row: { paddingVertical: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 },
  kind: { color: colors.inkSoft, fontSize: 10, ...typography.label, letterSpacing: 1 },
  body: { color: colors.ink, fontSize: 16, lineHeight: 24, ...typography.body },
  more: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  moreText: { color: colors.ink, fontSize: 14, ...typography.heading },
  meta: { color: colors.stone, fontSize: 13, lineHeight: 18, ...typography.body },
});
