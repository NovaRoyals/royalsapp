import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticKind = 'light' | 'medium' | 'success' | 'warning' | 'error';

export function haptic(kind: HapticKind = 'light') {
  if (Platform.OS === 'web') return;
  const run =
    kind === 'medium'
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      : kind === 'success'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : kind === 'warning'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          : kind === 'error'
            ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
            : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  run.catch(() => undefined);
}
