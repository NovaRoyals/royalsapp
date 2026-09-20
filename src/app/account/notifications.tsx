import { Pressable, StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/ui';
import { useApp } from '@/state/AppProvider';
import { colors, spacing, typography } from '@/theme/tokens';

import { Header } from './personal';

export default function AccountNotificationsScreen() {
  const { notificationPrefs, setNotificationPrefs } = useApp();
  return (
    <Screen>
      <Header title="Notification settings" />
      <Text style={styles.lead}>Never miss a schedule change. Choose what reaches this device — we ask before any OS permission.</Text>
      <Pressable onPress={() => setNotificationPrefs({ ...notificationPrefs, team: !notificationPrefs.team })} style={styles.row}>
        <Text style={styles.label}>Team alerts {notificationPrefs.team ? 'on' : 'off'}</Text>
      </Pressable>
      <Pressable onPress={() => setNotificationPrefs({ ...notificationPrefs, community: !notificationPrefs.community })} style={styles.row}>
        <Text style={styles.label}>Community {notificationPrefs.community ? 'on' : 'off'}</Text>
      </Pressable>
      <Pressable onPress={() => setNotificationPrefs({ ...notificationPrefs, locationShare: !notificationPrefs.locationShare })} style={styles.row}>
        <Text style={styles.label}>Find fields near you {notificationPrefs.locationShare ? 'on' : 'off'}</Text>
      </Pressable>
      <Text style={styles.note}>Location stays opt-in. Urgent field closures always appear in-app.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.stone, marginBottom: spacing.lg, ...typography.body },
  row: { minHeight: 52, justifyContent: 'center' },
  label: { color: colors.ink, fontSize: 16, ...typography.heading },
  note: { color: colors.stone, marginTop: spacing.md, ...typography.body },
});
