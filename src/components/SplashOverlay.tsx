import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/lib/reducedMotion';
import { colors, typography } from '@/theme/tokens';

export const SPLASH_SESSION_KEY = 'royals.cold-open-splash.v2';
const LETTERS = ['R', 'O', 'Y', 'A', 'L', 'S'];

export function SplashOverlay({
  play,
  onFinished,
}: {
  play: boolean;
  onFinished?: () => void;
}) {
  const reduced = useReducedMotion();
  const [playCycle, setPlayCycle] = useState(play);
  const [hidden, setHidden] = useState(false);
  if (play !== playCycle) {
    setPlayCycle(play);
    if (play) setHidden(false);
  }
  const visible = play && !hidden;
  const veil = useSharedValue(play ? 1 : 0);
  const settled = useRef(false);

  const finish = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    setHidden(true);
    onFinished?.();
  }, [onFinished]);

  useEffect(() => {
    if (!play) return;
    settled.current = false;
    veil.value = 1;
    const failsafe = setTimeout(finish, reduced ? 220 : 1300);
    if (reduced) {
      return () => clearTimeout(failsafe);
    }
    veil.value = withDelay(
      720,
      withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(finish)();
      }),
    );
    return () => clearTimeout(failsafe);
  }, [play, reduced, veil, finish]);

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.veil, veilStyle]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Skip intro" onPress={finish} style={styles.hit}>
        <Text style={styles.eyebrow}>NOVA</Text>
        <View style={styles.row}>
          {LETTERS.map((letter, index) => (
            <Letter key={letter} letter={letter} delay={index * 45} reduced={reduced} />
          ))}
        </View>
        <Text style={styles.sub}>Athletic Club</Text>
      </Pressable>
    </Animated.View>
  );
}

function Letter({ letter, delay, reduced }: { letter: string; delay: number; reduced: boolean }) {
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    progress.value = reduced ? 1 : withDelay(delay, withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }));
  }, [delay, progress, reduced]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 12 }],
  }));
  return <Animated.Text style={[styles.letter, style]}>{letter}</Animated.Text>;
}

const styles = StyleSheet.create({
  veil: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 80,
    backgroundColor: colors.ink,
  },
  hit: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: colors.mint, textAlign: 'center', fontSize: 11, letterSpacing: 2, fontFamily: typography.label.fontFamily },
  row: { flexDirection: 'row', justifyContent: 'center' },
  letter: { color: colors.white, fontSize: 52, lineHeight: 56, ...typography.display },
  sub: { color: colors.mint, textAlign: 'center', marginTop: 6, fontSize: 12, ...typography.body },
});
