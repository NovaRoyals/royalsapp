import { Ionicons } from '@expo/vector-icons';
import { useEffect, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Confetti, FlowBackdrop } from '@/components/onboarding/Decor';
import { Roy } from '@/components/mascot';
import type { RoyPose } from '@/components/mascot/poses';
import { useReducedMotion } from '@/lib/reducedMotion';
import { colors, layout, spacing, typography } from '@/theme/tokens';

function Progress({ step, total }: { step: number; total: number }) {
  const reduced = useReducedMotion();
  const value = useSharedValue(step / total);

  useEffect(() => {
    const next = Math.min(1, Math.max(0, step / total));
    value.value = reduced ? next : withTiming(next, { duration: 380, easing: Easing.out(Easing.cubic) });
  }, [reduced, step, total, value]);

  const fill = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));

  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: step }} style={styles.track}>
      <Animated.View style={[styles.fill, fill]} />
    </View>
  );
}

export function FlowShell({
  tone = 'light',
  step,
  total,
  onBack,
  onSkip,
  skipLabel = 'Skip',
  above,
  roy,
  confetti,
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  footnote,
  fill = false,
}: {
  tone?: 'dark' | 'light';
  step?: number;
  total?: number;
  onBack?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  above?: ReactNode;
  roy?: { pose: RoyPose; size?: number };
  confetti?: boolean;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
  footnote?: ReactNode;
  fill?: boolean;
}) {
  const dark = tone === 'dark';
  const showHeader = Boolean(onBack || onSkip || (step && total));

  return (
    <View style={[styles.root, dark && styles.rootDark]}>
      <FlowBackdrop tone={tone} />
      {confetti ? <Confetti /> : null}
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        {showHeader ? (
          <View style={styles.headerInner}>
            {onBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={onBack}
                style={({ pressed }) => [styles.iconButton, dark && styles.iconButtonDark, pressed && styles.pressed]}
              >
                <Ionicons name="chevron-back" size={20} color={dark ? colors.white : colors.ink} />
              </Pressable>
            ) : (
              <View style={styles.iconButtonSpacer} />
            )}
            {step && total ? <Progress step={step} total={total} /> : <View style={styles.flex} />}
            {onSkip ? (
              <Pressable accessibilityRole="button" onPress={onSkip} style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
                <Text style={[styles.skipText, dark && styles.skipTextDark]}>{skipLabel}</Text>
              </Pressable>
            ) : (
              <View style={styles.iconButtonSpacer} />
            )}
          </View>
        ) : null}

        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scroll, fill && styles.scrollFill]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.stage, fill && styles.flex]}>
            <View style={[styles.inner, fill && styles.flex]}>
              {above}
              {roy ? (
                <View style={[styles.royStage, { height: roy.size ?? 220 }]}>
                  <Roy pose={roy.pose} still size={roy.size ?? 220} scene={dark ? 'dark' : 'light'} />
                </View>
              ) : null}
              {fill ? <View style={styles.flex} /> : null}
              <View style={fill ? styles.copyBlock : undefined}>
                {eyebrow ? <Text style={[styles.eyebrow, dark && styles.eyebrowDark]}>{eyebrow}</Text> : null}
                {title ? <Text style={[styles.title, dark && styles.titleDark]}>{title}</Text> : null}
                {subtitle ? <Text style={[styles.subtitle, dark && styles.subtitleDark]}>{subtitle}</Text> : null}
              </View>
              {children ? <View style={styles.body}>{children}</View> : null}
            </View>
          </View>
        </ScrollView>

        {footer ? (
          <View style={styles.footer}>
            <View style={styles.inner}>
              {footer}
              {footnote}
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  rootDark: { backgroundColor: colors.ink },
  safe: { flex: 1 },
  flex: { flex: 1 },
  headerInner: {
    width: '100%',
    maxWidth: layout.flowWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
  iconButtonSpacer: { width: 36, height: 36 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.mintDeep, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2, backgroundColor: colors.ink },
  skip: { minWidth: 36, height: 36, alignItems: 'flex-end', justifyContent: 'center' },
  skipText: { color: colors.stone, fontSize: 13, ...typography.label },
  skipTextDark: { color: 'rgba(255,255,255,0.7)' },
  pressed: { opacity: 0.65 },
  scroll: { flexGrow: 1, paddingTop: 8, paddingBottom: 16 },
  scrollFill: { flexGrow: 1 },
  stage: { flexGrow: 1, justifyContent: 'center' },
  body: { marginTop: 18, gap: 0 },
  inner: { width: '100%', maxWidth: layout.flowWidth, alignSelf: 'center', paddingHorizontal: 22 },
  royStage: { alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, marginBottom: -8 },
  copyBlock: { paddingBottom: 8 },
  eyebrow: { color: colors.greenBright, fontSize: 11, marginBottom: 6, ...typography.label, letterSpacing: 1.6 },
  eyebrowDark: { color: colors.mintDeep },
  title: { color: colors.ink, fontSize: 30, lineHeight: 34, ...typography.display },
  titleDark: { color: colors.white, fontSize: 40, lineHeight: 42 },
  subtitle: { color: colors.stone, fontSize: 14, lineHeight: 20, marginTop: 8, maxWidth: 340, ...typography.body },
  subtitleDark: { color: 'rgba(255,255,255,0.78)' },
  footer: {
    paddingTop: 8,
    paddingBottom: Platform.OS === 'web' ? 20 : 8,
  },
});
