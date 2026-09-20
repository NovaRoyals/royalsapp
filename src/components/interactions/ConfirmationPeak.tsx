import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

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
  const ring = useSharedValue(0.35);
  useEffect(() => {
    haptic('success');
    ring.value = reduced ? 1 : withTiming(1, { duration: 420 });
  }, [ring, reduced]);
  const ringStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(232, 85, 47, ${ring.value})`,
    transform: [{ scale: 0.96 + ring.value * 0.04 }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.shield, ringStyle]}>
        <Text style={styles.mark}>R</Text>
      </Animated.View>
      <Text style={styles.kicker}>CONFIRMED</Text>
      <Text style={styles.title}>{name.toUpperCase()} IS A ROYAL</Text>
      <Text style={styles.program}>{program}</Text>
      <Text style={styles.session}>{sessionLine}</Text>
      <Button label="Add season to calendar" onPress={onCalendar} />
      <Button label="Meet the coach" variant="secondary" onPress={onCoach} />
      <Button label={`View ${name}’s season`} variant="ghost" onPress={onSeason} />
      <Button label="Share the news" variant="ghost" onPress={onShare} />
    </View>
  );
}

export async function shareRegistration(name: string) {
  return shareContent({
    title: `${name} is a Royal`,
    message: `${name} just joined Nova Royals Athletic Club.`,
    url: typeof window !== 'undefined' ? window.location.origin : undefined,
  });
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl },
  shield: {
    width: 88,
    height: 88,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: colors.orange,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
  },
  mark: { color: colors.orange, fontSize: 42, ...typography.display },
  kicker: { color: colors.stone, fontSize: 11, ...typography.label },
  title: { color: colors.ink, fontSize: 34, lineHeight: 38, textAlign: 'center', ...typography.display },
  program: { color: colors.charcoal, fontSize: 16, textAlign: 'center', ...typography.heading },
  session: { color: colors.stone, fontSize: 14, textAlign: 'center', marginBottom: spacing.md, ...typography.body },
});
