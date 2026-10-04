import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { InkHold } from '@/components/HydrationGate';
import { PrototypeMark } from '@/components/PrototypeMark';
import { SplashOverlay, SPLASH_SESSION_KEY } from '@/components/SplashOverlay';
import { hydrateTrace, hydrateTraceEffect } from '@/lib/hydrateTrace';
import { useApp } from '@/state/AppProvider';

const TAB_PATHS = new Set(['/', '/programs', '/schedule', '/fields', '/profile']);

/** Screens that must open as they are: the welcome flow itself, and the pages email links return to. */
const isFlowPath = (pathname: string) => pathname === '/onboarding' || pathname.startsWith('/auth/');

export function FirstOpenGate({ children }: { children: ReactNode }) {
  const { hasHydrated, introCompleted } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [splashDecision, setSplashDecision] = useState<{ intro: boolean; mode: 'play' | 'skip' } | null>(null);
  const [dismissedIntro, setDismissedIntro] = useState<boolean | null>(null);
  const [splashDone, setSplashDone] = useState(false);

  hydrateTrace('FirstOpenGate', {
    hasHydrated,
    introCompleted,
    pathname,
    willRedirectToOnboarding: hasHydrated && !introCompleted && !isFlowPath(pathname),
  });

  useEffect(() => {
    hydrateTraceEffect('FirstOpenGate', { hasHydrated, introCompleted, pathname });
    if (!hasHydrated) return;
    if (!introCompleted && !isFlowPath(pathname)) {
      router.replace('/onboarding');
    }
  }, [hasHydrated, introCompleted, pathname, router]);

  if (hasHydrated && splashDecision?.intro !== introCompleted) {
    let skip = false;
    if (introCompleted && typeof sessionStorage !== 'undefined') {
      try {
        skip = sessionStorage.getItem(SPLASH_SESSION_KEY) === '1';
        if (!skip) sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
      } catch {
        skip = false;
      }
    }
    setSplashDecision({ intro: introCompleted, mode: skip ? 'skip' : 'play' });
  }
  if (splashDecision && dismissedIntro !== splashDecision.intro) {
    setDismissedIntro(splashDecision.intro);
    setSplashDone(splashDecision.mode === 'skip');
  }
  const splashPlay = splashDecision?.mode === 'play' && !splashDone;

  const onFinished = useCallback(() => {
    setSplashDone(true);
  }, []);

  if (!hasHydrated) return <InkHold />;

  const waitingForOnboarding = !introCompleted && !isFlowPath(pathname);

  return (
    <View style={styles.fill}>
      {waitingForOnboarding ? <InkHold /> : children}
      <PrototypeMark aboveTabs={TAB_PATHS.has(pathname)} />
      <SplashOverlay play={splashPlay && !splashDone} onFinished={onFinished} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
