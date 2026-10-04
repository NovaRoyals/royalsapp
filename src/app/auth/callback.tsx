import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { FlowShell } from '@/components/onboarding/FlowShell';
import { Button } from '@/components/ui';
import { account } from '@/services/account';
import { useApp } from '@/state/AppProvider';
import { colors, typography } from '@/theme/tokens';

/**
 * Where an email link (confirm your email, reset your password) and Google bring someone back to.
 * It reads the address, signs them in, and sends them on. On the web the address is wiped from the
 * browser history afterwards so the sign-in token does not stay in it.
 */
export default function AuthCallbackScreen() {
  const { onboardingCompleted, hasHydrated } = useApp();
  const nativeUrl = Linking.useURL();
  const [message, setMessage] = useState('');
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || !hasHydrated) return;
    const url = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : nativeUrl;
    if (!url) return;
    handled.current = true;

    account.applyCallback(url).then((outcome) => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname);
      if (!outcome.ok) {
        setMessage(outcome.message);
        return;
      }
      if (outcome.status === 'signed-in' && outcome.recovery) {
        router.replace('/auth/reset' as never);
        return;
      }
      router.replace((onboardingCompleted ? '/(tabs)' : '/onboarding?from=link') as never);
    });
  }, [hasHydrated, nativeUrl, onboardingCompleted]);

  if (message) {
    return (
      <FlowShell
        stepKey="callback-error"
        roy={{ pose: 'smile', size: 120, decorative: true }}
        title="That didn’t work"
        subtitle={message}
        footer={<Button label="Back to sign in" onPress={() => router.replace('/onboarding?mode=signin' as never)} />}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>Signing you in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  text: { color: colors.ink, fontSize: 16, ...typography.heading },
});
