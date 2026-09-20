import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SplashOverlay, SPLASH_SESSION_KEY } from '@/components/SplashOverlay';
import { useApp } from '@/state/AppProvider';
import { colors } from '@/theme/tokens';

function InkHold() {
  return (
    <View style={styles.veil} accessibilityLabel="ROYALS">
      <Text style={styles.eyebrow}>NOVA</Text>
      <Text style={styles.mark}>ROYALS</Text>
      <Text style={styles.sub}>Athletic Club</Text>
    </View>
  );
}

export function FirstOpenGate({ children }: { children: ReactNode }) {
  const { hydrated, introCompleted } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [splashPlay, setSplashPlay] = useState(true);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    const onboarding = pathname === '/onboarding';
    if (!introCompleted && !onboarding) {
      router.replace('/onboarding');
    }
  }, [hydrated, introCompleted, pathname, router]);

  useEffect(() => {
    if (!hydrated) return;
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
  }, [hydrated, introCompleted]);

  const onFinished = useCallback(() => {
    setSplashDone(true);
    setSplashPlay(false);
  }, []);

  if (!hydrated) return <InkHold />;

  const waitingForOnboarding = !introCompleted && pathname !== '/onboarding';

  return (
    <View style={styles.fill}>
      {waitingForOnboarding ? <InkHold /> : children}
      <SplashOverlay play={splashPlay && !splashDone} onFinished={onFinished} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  veil: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { color: colors.mint, fontSize: 11, letterSpacing: 2 },
  mark: { color: colors.white, fontSize: 52, letterSpacing: 2 },
  sub: { color: colors.mint, marginTop: 6, fontSize: 12 },
});
