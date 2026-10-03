import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { royPoseSource } from '@/components/mascot/poses';
import { Button } from '@/components/ui';
import { shareContent } from '@/lib/share';
import { haptic } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/reducedMotion';
import { colors, spacing, typography } from '@/theme/tokens';

export function ConfirmationPeak({
  name,
  program,
  sessionLine,
  onCalendar,
  onCoach,
  onSeason,
  onShare,
}: {
  name: string;
  program: string;
  sessionLine: string;
  onCalendar: () => void;
  onCoach: () => void;
  onSeason: () => void;
  onShare: () => void;
}) {
  const reduced = useReducedMotion();
  const arrive = useSharedValue(0);
  useEffect(() => {
    haptic('success');
    arrive.value = reduced ? 1 : withSpring(1, { damping: 14, stiffness: 190 });
  }, [arrive, reduced]);
  // Roy pops up once when the registration lands. Nothing loops.
  const royStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, arrive.value * 1.6),
    transform: [{ translateY: (1 - arrive.value) * 40 }, { scale: 0.82 + arrive.value * 0.18 }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.roy, royStyle]}>
        <Image source={royPoseSource.celebrate} style={styles.royImage} contentFit="contain" alt="" />
      </Animated.View>
      <Text style={styles.kicker}>REGISTRATION SUBMITTED</Text>
      <Text style={styles.title}>WELCOME, {name.toUpperCase()}</Text>
      <Text style={styles.program}>{program}</Text>
      <Text style={styles.session}>{sessionLine}</Text>
      <Text style={styles.session}>Pending club review. Payment has not been taken.</Text>
      <Button label="Preview season calendar" onPress={onCalendar} />
      <Button label="Meet the coach" variant="secondary" onPress={onCoach} />
      <Button label="View season" variant="ghost" onPress={onSeason} />
      <Button label="Share the news" variant="ghost" onPress={onShare} />
    </View>
  );
}

export async function shareRegistration(name: string) {
  return shareContent({
    title: `${name} signed up with ROYALS`,
    message: `${name} signed up for Nova Royals Athletic Club.`,
    url: typeof window !== 'undefined' ? window.location.origin : undefined,
  });
}

const styles = StyleSheet.create({
  roy: { width: 168, height: 168 },
  royImage: { width: '100%', height: '100%' },
  wrap: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl },
  kicker: { color: colors.stone, fontSize: 11, ...typography.label },
  title: { color: colors.ink, fontSize: 34, lineHeight: 38, textAlign: 'center', ...typography.display },
  program: { color: colors.charcoal, fontSize: 16, textAlign: 'center', ...typography.heading },
  session: { color: colors.stone, fontSize: 14, textAlign: 'center', marginBottom: spacing.md, ...typography.body },
});
