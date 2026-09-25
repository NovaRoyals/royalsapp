import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';

import { fontAssets } from '@/theme/fonts';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export function FontGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    let alive = true;
    Font.loadAsync(fontAssets)
      .catch(() => undefined)
      .finally(() => {
        if (!alive) return;
        SplashScreen.hideAsync().catch(() => undefined);
      });
    return () => {
      alive = false;
    };
  }, []);

  return children;
}
