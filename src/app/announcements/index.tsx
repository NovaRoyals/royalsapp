import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AnnouncementCard } from '@/components/announcements/AnnouncementCard';
import { EmptyState, Screen } from '@/components/ui';
import { canSendAnnouncement, splitAnnouncements, visibleTo } from '@/lib/announcements';
import { safeBack } from '@/lib/nav';
import { useApp } from '@/state/AppProvider';
import { useViewer } from '@/state/useViewer';
import { colors, spacing, typography } from '@/theme/tokens';

/**
 * Where announcements live. Not a tab: Home shows the one that matters now, and this is the full
 * list, with what is current first and everything older under Past.
 */
export default function AnnouncementsScreen() {
  const { announcements, role } = useApp();
  const viewer = useViewer();
  const [view, setView] = useState<'latest' | 'past'>('latest');
  const { latest, past } = useMemo(() => splitAnnouncements(announcements.filter((item) => visibleTo(item, viewer))), [announcements, viewer]);
  const list = view === 'latest' ? latest : past;
  const staff = canSendAnnouncement(role);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => safeBack('/(tabs)')} style={styles.back}>
          <Ionicons name="arrow-back" size={21} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Announcements</Text>
        {staff ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Write an announcement" onPress={() => router.push('/announcements/new' as never)} style={styles.compose}>
            <Ionicons accessible={false} name="create-outline" size={18} color={colors.white} />
            <Text style={styles.composeText}>New</Text>
          </Pressable>
        ) : (
          <View style={styles.spacer} />
        )}
      </View>

      <View accessibilityRole="tablist" style={styles.tabs}>
        {([
          ['latest', 'Latest', latest.length],
          ['past', 'Past', past.length],
        ] as const).map(([id, label, count]) => (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === id }}
            onPress={() => setView(id)}
            style={[styles.tab, view === id && styles.tabOn]}
          >
            <Text style={[styles.tabText, view === id && styles.tabTextOn]}>{label}</Text>
            <Text style={[styles.count, view === id && styles.tabTextOn]}>{count}</Text>
          </Pressable>
        ))}
      </View>

      {list.length === 0 ? (
        <EmptyState
          pose={view === 'latest' ? 'thumbsup' : 'lookRight'}
          title={view === 'latest' ? 'All quiet' : 'Nothing older yet'}
          message={view === 'latest' ? 'New announcements from your coach and the club will show up here.' : 'Older announcements are kept here.'}
        />
      ) : (
        list.map((item) => <AnnouncementCard key={item.id} announcement={item} onPress={() => router.push(`/message/${item.id}` as never)} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  spacer: { width: 44, height: 44 },
  title: { flex: 1, color: colors.ink, fontSize: 24, ...typography.pageTitle },
  compose: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, borderRadius: 999, backgroundColor: colors.ink },
  composeText: { color: colors.white, fontSize: 14, ...typography.label },
  tabs: { flexDirection: 'row', backgroundColor: colors.sand, borderRadius: 16, padding: 4, marginVertical: 10 },
  tab: { flex: 1, minHeight: 42, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  tabOn: { backgroundColor: colors.ink },
  tabText: { color: colors.stone, fontSize: 14, ...typography.label },
  tabTextOn: { color: colors.white },
  count: { color: colors.stone, fontSize: 12, ...typography.label },
});
