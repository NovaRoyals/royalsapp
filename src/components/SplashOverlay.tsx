import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
  const [visible, setVisible] = useState(play);
  const veil = useSharedValue(play ? 1 : 0);
  const lift = useSharedValue(0);

  useEffect(() => {
    if (!play) {
      setVisible(false);
      return;
    }
    setVisible(true);
    veil.value = 1;
    lift.value = 0;
    const finish = () => {
      setVisible(false);
      onFinished?.();
    };
    if (reduced) {
      const t = setTimeout(finish, 180);
      return () => clearTimeout(t);
    }
    lift.value = withDelay(1100, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
    veil.value = withDelay(
      1480,
      withTiming(0, { duration: 360, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(finish)();
      }),
    );
  }, [play, reduced, lift, veil]);

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));
  const markStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.value * 36 }],
  }));

  if (!visible) return null;

  return (
    <Animated.View pointerEvents="auto" style={[styles.veil, veilStyle]}>
      <Animated.View style={markStyle}>
        <Text style={styles.eyebrow}>NOVA</Text>
        <View style={styles.row}>
          {LETTERS.map((letter, index) => (
            <Letter key={letter} letter={letter} delay={index * 90} reduced={reduced} />
          ))}
        </View>
        <Text style={styles.sub}>Athletic Club</Text>
      </Animated.View>
    </Animated.View>
  );
}

function Letter({ letter, delay, reduced }: { letter: string; delay: number; reduced: boolean }) {
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    progress.value = reduced ? 1 : withDelay(delay, withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }));
  }, [delay, progress, reduced]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 22 }, { scale: 0.84 + progress.value * 0.16 }],
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { color: colors.mint, textAlign: 'center', fontSize: 11, letterSpacing: 2, fontFamily: typography.label.fontFamily },
  row: { flexDirection: 'row', justifyContent: 'center' },
  letter: { color: colors.white, fontSize: 52, lineHeight: 56, ...typography.display },
  sub: { color: colors.mint, textAlign: 'center', marginTop: 6, fontSize: 12, ...typography.body },
});
