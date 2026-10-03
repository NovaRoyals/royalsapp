import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Link, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { CloudBackdrop } from '@/components/brand/CloudBackdrop';
import { royPoseSource, type RoyPose } from '@/components/mascot/poses';
import { useReducedMotion } from '@/lib/reducedMotion';
import { motion } from '@/theme/motion';
import { colors, gradients, radius, typography } from '@/theme/tokens';

type Action = { label: string; onPress: () => void };

/**
 * The one thing to do next, on deep green with Roy beside it.
 *
 * Motion has two jobs only. On first show Roy rises into place once, so the card feels
 * like it arrived rather than appeared. While a finger is down the card sinks a hair and
 * Roy lifts, which tells you the whole card is tappable. Nothing loops.
 */
export function HeroStoryCard({
  href,
  kicker,
  weekday,
  day,
  month,
  headline,
  support,
  facts,
  signal,
  action,
  tone,
  pose,
}: {
  href: Href;
  kicker: string;
  weekday: string;
  day: string;
  month: string;
  headline: string;
  support?: string;
  facts: string;
  signal?: string;
  action?: Action;
  tone: 'upcoming' | 'live' | 'result';
  pose: RoyPose;
}) {
  const reduced = useReducedMotion();
  const press = useSharedValue(0);
  const arrive = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      arrive.value = 1;
      return;
    }
    arrive.value = withDelay(160, withTiming(1, { duration: 380, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
  }, [arrive, reduced]);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.value * 0.015 }] }));
  const royStyle = useAnimatedStyle(() => ({
    opacity: arrive.value,
    transform: [{ translateY: (1 - arrive.value) * 34 - press.value * 8 }, { scale: 1 + press.value * 0.035 }],
  }));
  const setPress = (value: number) => {
    if (reduced) return;
    press.value = withSpring(value, motion.spring.press);
  };

  return (
    <Animated.View style={[styles.card, cardStyle]}>
      <LinearGradient colors={gradients.night} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <CloudBackdrop />
      <Animated.View pointerEvents="none" style={[styles.roy, royStyle]}>
        <Image source={royPoseSource[pose]} style={styles.royImage} contentFit="contain" alt="" accessibilityIgnoresInvertColors />
      </Animated.View>
      <Link href={href} asChild>
        <Pressable onPressIn={() => setPress(1)} onPressOut={() => setPress(0)} style={styles.body}>
          <View style={styles.kickerRow}>
            {tone === 'live' ? <View style={styles.liveDot} /> : null}
            <Text style={styles.kicker}>{tone === 'live' ? 'LIVE NOW' : kicker.toUpperCase()}</Text>
          </View>
          <View style={styles.dateRow}>
            <Text style={styles.day}>{day}</Text>
            <View>
              <Text style={styles.weekday}>{weekday}</Text>
              <Text style={styles.month}>{month}</Text>
            </View>
          </View>
          <Text style={styles.headline}>{headline}</Text>
          {support ? <Text style={styles.meta}>{support}</Text> : null}
          <Text style={styles.meta}>{facts}</Text>
          {signal ? <Text style={styles.signal}>{signal}</Text> : null}
        </Pressable>
      </Link>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          onPressIn={() => setPress(0.6)}
          onPressOut={() => setPress(0)}
          style={({ pressed }) => [styles.action, pressed && !reduced && { opacity: motion.press.opacity }]}
        >
          <Text style={styles.actionText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.panel,
    overflow: 'hidden',
    marginBottom: 16,
    minHeight: 236,
    backgroundColor: colors.greenDeep,
  },
  body: { paddingTop: 20, paddingHorizontal: 20, paddingRight: 128 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kicker: { color: colors.mint, fontSize: 10, ...typography.label, letterSpacing: 1.6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange },
  dateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 8 },
  day: { color: colors.white, fontSize: 64, lineHeight: 62, ...typography.display },
  weekday: { color: colors.gold, fontSize: 13, ...typography.label, letterSpacing: 1.4 },
  month: { color: colors.mint, fontSize: 12, marginBottom: 6, ...typography.label, letterSpacing: 1.2 },
  headline: { color: colors.white, fontSize: 21, lineHeight: 25, marginTop: 10, ...typography.heading },
  meta: { color: 'rgba(255,255,255,0.78)', fontSize: 12, lineHeight: 17, marginTop: 4, ...typography.body },
  signal: { color: colors.gold, fontSize: 12, marginTop: 6, ...typography.label },
  action: {
    alignSelf: 'flex-start',
    minHeight: 44,
    marginLeft: 20,
    marginTop: 14,
    marginBottom: 20,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: colors.ink, fontSize: 14, ...typography.label },
  roy: { position: 'absolute', right: -14, bottom: -28, width: 168, height: 168 },
  royImage: { width: '100%', height: '100%' },
});
