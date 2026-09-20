import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { colors, radius, spacing, typography } from '@/theme/tokens';

const ToastContext = createContext<(message: string) => void>(() => undefined);

export function ToastHost({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const show = useCallback((next: string) => {
    setMessage(next);
    setTimeout(() => setMessage(null), 2400);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message ? (
        <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOutDown.duration(180)} style={styles.toast}>
          <Text style={styles.text}>{message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 96,
    zIndex: 60,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
    alignItems: 'center',
  },
  text: { color: colors.white, fontSize: 14, textAlign: 'center', ...typography.heading },
});
