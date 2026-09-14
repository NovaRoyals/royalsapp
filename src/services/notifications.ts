import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function configureNotificationChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('royals-reminders', {
    name: 'Royals reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 120, 180],
    lightColor: '#F36A21',
  });
}

export async function scheduleLocalReminder(title: string, body: string, date: Date) {
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data: { source: 'royals-local-reminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: Platform.OS === 'android' ? 'royals-reminders' : undefined,
    },
  });
}

// Remote tokens and delivery are intentionally deferred until EAS/project push
// credentials exist. The in-app notification center does not depend on them.
