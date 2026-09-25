import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { InkHold } from '@/components/HydrationGate';
import { PrototypeMark } from '@/components/PrototypeMark';
import { SplashOverlay, SPLASH_SESSION_KEY } from '@/components/SplashOverlay';
import { hydrateTrace, hydrateTraceEffect } from '@/lib/hydrateTrace';
import { useApp } from '@/state/AppProvider';

export function FirstOpenGate({ children }: { children: ReactNode }) {
  const { hasHydrated, introCompleted } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [splashPlay, setSplashPlay] = useState(true);
  const [splashDone, setSplashDone] = useState(false);

  hydrateTrace('FirstOpenGate', {
    hasHydrated,
    introCompleted,
    pathname,
    willRedirectToOnboarding: hasHydrated && !introCompleted && pathname !== '/onboarding',
  });

  useEffect(() => {
    hydrateTraceEffect('FirstOpenGate', { hasHydrated, introCompleted, pathname });
    if (!hasHydrated) return;
    const onboarding = pathname === '/onboarding';
    if (!introCompleted && !onboarding) {
      router.replace('/onboarding');
    }
  }, [hasHydrated, introCompleted, pathname, router]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!introCompleted) {
      setSplashPlay(true);
      setSplashDone(false);
      return;
    }
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SPLASH_SESSION_KEY)) {
        setSplashPlay(false);
        setSplashDone(true);
        return;
      }
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
    } catch {
      undefined;
    }
    setSplashPlay(true);
  }, [hasHydrated, introCompleted]);

  const onFinished = useCallback(() => {
    setSplashDone(true);
    setSplashPlay(false);
  }, []);

  if (!hasHydrated) return <InkHold />;

  const waitingForOnboarding = !introCompleted && pathname !== '/onboarding';

  return (
    <View style={styles.fill}>
      {waitingForOnboarding ? <InkHold /> : children}
      <PrototypeMark />
      <SplashOverlay play={splashPlay && !splashDone} onFinished={onFinished} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
