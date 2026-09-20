import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Screen } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { notificationsForRole } from '@/lib/membership';
import { formatEventParts } from '@/lib/datetime';
import { useReducedMotion } from '@/lib/reducedMotion';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const icons = {
  registration: 'checkmark-circle-outline',
  reminder: 'alarm-outline',
  change: 'swap-horizontal-outline',
  weather: 'rainy-outline',
  announcement: 'megaphone-outline',
  result: 'trophy-outline',
} as const;

export default function NotificationsScreen() {
  const { notifications, markNotificationRead, markAllNotificationsRead, role } = useApp();
  const toast = useToast();
  const visible = notificationsForRole(role, notifications);
  const reduced = useReducedMotion();

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={21} /></Pressable>
        <View style={styles.flex}><Text style={styles.eyebrow}>UPDATES</Text><Text style={styles.title}>Notifications</Text></View>
        <Pressable
          onPress={() => {
            markAllNotificationsRead();
            toast('Caught up');
          }}
          style={styles.markAll}
        >
          <Text style={styles.markAllText}>Read all</Text>
        </Pressable>
      </View>
      <View style={styles.preferences}>
        <Ionicons name="notifications-outline" size={21} color={colors.orangeDark} />
        <View style={styles.flex}><Text style={styles.preferenceTitle}>Reminders are ready</Text><Text style={styles.preferenceCopy}>Expo notification channels are configured without requiring push credentials locally.</Text></View>
      </View>
      <Text style={styles.section}>RECENT</Text>
      <View style={styles.list}>
        {visible.map((notice, index) => (
          <Animated.View key={notice.id} entering={reduced || index > 0 ? undefined : FadeInDown.duration(240)}>
          <Pressable
            key={notice.id}
            onPress={() => {
              markNotificationRead(notice.id);
              if (notice.route) router.push(notice.route as never);
            }}
            style={[styles.notice, !notice.read && styles.unread]}
          >
            <View style={[styles.icon, !notice.read && styles.iconUnread]}>
              <Ionicons name={icons[notice.type]} size={21} color={!notice.read ? colors.orangeDark : colors.stone} />
            </View>
            <View style={styles.flex}>
              <View style={styles.noticeTop}>
                <Text style={styles.noticeTitle}>{notice.title}</Text>
                {!notice.read ? <View style={styles.dot} /> : null}
              </View>
              <Text style={styles.noticeBody}>{notice.body}</Text>
              <Text style={styles.time}>{formatEventParts(notice.createdAt).month} {formatEventParts(notice.createdAt).day}{notice.type === 'announcement' ? ' · Club-wide' : ''}{notice.urgency ? ` · ${notice.urgency}` : ''}{notice.wouldPush ? ' · would push' : ''}</Text>
            </View>
          </Pressable>
          </Animated.View>
        ))}
      </View>
      <View style={styles.safety}>
        <Ionicons name="shield-checkmark-outline" size={22} color={colors.success} />
        <Text style={styles.safetyText}>Youth accounts do not receive public community or open-chat notifications by default.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  eyebrow: { color: colors.orangeDark, fontSize: 9, ...typography.label, letterSpacing: 1.1 },
  title: { color: colors.ink, fontSize: 27, ...typography.heading },
  markAll: { minHeight: 44, justifyContent: 'center' },
  markAllText: { color: colors.orangeDark, fontSize: 11, ...typography.label },
  preferences: { marginTop: spacing.md, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.orangeSoft, flexDirection: 'row', gap: spacing.md },
  preferenceTitle: { color: colors.orangeDark, fontSize: 14, ...typography.heading },
  preferenceCopy: { color: colors.charcoal, fontSize: 11, lineHeight: 17, marginTop: 3, ...typography.body },
  section: { color: colors.stone, fontSize: 10, marginTop: spacing.xxl, marginBottom: spacing.sm, ...typography.label, letterSpacing: 1 },
  list: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.paper },
  notice: { minHeight: 104, padding: spacing.lg, flexDirection: 'row', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  unread: { backgroundColor: '#FFF7F0' },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  iconUnread: { backgroundColor: colors.orangeSoft },
  noticeTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noticeTitle: { flex: 1, color: colors.ink, fontSize: 14, ...typography.heading },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange },
  noticeBody: { color: colors.stone, fontSize: 12, lineHeight: 18, marginTop: 4, ...typography.body },
  time: { color: colors.orangeDark, fontSize: 9, marginTop: spacing.sm, ...typography.label, textTransform: 'uppercase' },
  safety: { marginTop: spacing.xl, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.successSoft, flexDirection: 'row', gap: spacing.md },
  safetyText: { flex: 1, color: colors.success, fontSize: 11, lineHeight: 17, ...typography.body },
});
