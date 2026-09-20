import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { FirstOpenGate } from '@/components/FirstOpenGate';
import { FontGate } from '@/components/FontGate';
import { AppProvider } from '@/state/AppProvider';
import { ToastHost } from '@/components/Toast';
import { colors } from '@/theme/tokens';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

export default function RootLayout() {
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'ROYALS · Nova Royals Athletic Club';
    }
  }, []);

  return (
    <FontGate>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <FirstOpenGate>
          <ToastHost>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.cream },
              animation: 'slide_from_right',
              animationDuration: 220,
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="program/[id]" />
            <Stack.Screen name="registration/[programId]" options={{ gestureEnabled: false, animation: 'slide_from_bottom', animationDuration: 280 }} />
            <Stack.Screen name="team/[id]" />
            <Stack.Screen name="competition/[id]" />
            <Stack.Screen name="event/[id]" />
            <Stack.Screen name="season/[registrationId]" />
            <Stack.Screen name="message/[id]" />
            <Stack.Screen name="about" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="onboarding" options={{ animation: 'slide_from_bottom', animationDuration: 280 }} />
            <Stack.Screen name="admin" />
            <Stack.Screen name="lab" />
            <Stack.Screen name="roy" />
            <Stack.Screen name="account/personal" />
            <Stack.Screen name="account/payments" />
            <Stack.Screen name="account/waivers" />
            <Stack.Screen name="account/notifications" />
          </Stack>
          </ToastHost>
          </FirstOpenGate>
        </AppProvider>
      </QueryClientProvider>
    </FontGate>
  );
}
