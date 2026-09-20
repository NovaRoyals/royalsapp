import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fontAssets } from '@/theme/fonts';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export function FontGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    Font.loadAsync(fontAssets)
      .catch(() => undefined)
      .finally(() => {
        if (!alive) return;
        setReady(true);
        SplashScreen.hideAsync().catch(() => undefined);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!ready) {
    return (
      <View style={styles.veil} accessibilityLabel="ROYALS">
        <Text style={styles.eyebrow}>NOVA</Text>
        <Text style={styles.mark}>ROYALS</Text>
        <Text style={styles.sub}>Athletic Club</Text>
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  veil: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: colors.mint,
    fontSize: 11,
    letterSpacing: 2,
  },
  mark: {
    color: colors.white,
    fontSize: 52,
    letterSpacing: 2,
  },
  sub: {
    color: colors.mint,
    marginTop: 6,
    fontSize: 12,
  },
});
