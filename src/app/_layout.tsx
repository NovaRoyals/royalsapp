import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AppProvider } from '@/state/AppProvider';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    if (typeof document !== 'undefined') {
      document.title = 'ROYALS · Nova Royals Athletic Club';
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
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
          <Stack.Screen name="registration/[programId]" options={{ gestureEnabled: false }} />
          <Stack.Screen name="team/[id]" />
          <Stack.Screen name="competition/[id]" />
          <Stack.Screen name="event/[id]" />
          <Stack.Screen name="season/[registrationId]" />
          <Stack.Screen name="message/[id]" />
          <Stack.Screen name="about" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="lab" />
        </Stack>
      </AppProvider>
    </QueryClientProvider>
  );
}
