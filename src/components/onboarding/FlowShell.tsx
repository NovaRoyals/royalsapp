import { Ionicons } from '@expo/vector-icons';
import { useEffect, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FlowBackdrop, RoyGlow } from '@/components/onboarding/Decor';
import { Roy } from '@/components/mascot';
import type { RoyPose } from '@/components/mascot/poses';
import type { RoyState } from '@/components/mascot/types';
import { useReducedMotion } from '@/lib/reducedMotion';
import { colors, layout, spacing, typography } from '@/theme/tokens';

function Progress({ step, total }: { step: number; total: number }) {
  const reduced = useReducedMotion();
  const value = useSharedValue(step / total);

  useEffect(() => {
    const next = Math.min(1, Math.max(0, step / total));
    value.value = reduced ? next : withTiming(next, { duration: 220, easing: Easing.out(Easing.cubic) });
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
  skipLabel = 'Explore as guest',
  above,
  roy,
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  footnote,
  fill = false,
  stepKey,
}: {
  tone?: 'dark' | 'light';
  step?: number;
  total?: number;
  onBack?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  above?: ReactNode;
  /** `state` plays Roy's motion once (he rests afterwards). Leave it out for a still Roy. */
  roy?: { pose: RoyPose; size?: number; decorative?: boolean; state?: RoyState; onComplete?: (state: RoyState) => void };
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
  footnote?: ReactNode;
  fill?: boolean;
  /** Changes when the step changes, so the content can slide in. */
  stepKey?: string;
}) {
  const reduced = useReducedMotion();
  const dark = tone === 'dark';
  const showHeader = Boolean(onBack || onSkip || (step && total));

  return (
    <View style={[styles.root, dark && styles.rootDark]}>
      <FlowBackdrop tone={tone} />
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        {showHeader ? (
          <View style={styles.headerInner}>
            {onBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={8}
                onPress={onBack}
                style={({ pressed }) => [styles.iconButton, dark && styles.iconButtonDark, pressed && styles.pressed]}
              >
                <Ionicons name="chevron-back" size={22} color={dark ? colors.white : colors.ink} />
              </Pressable>
            ) : (
              <View style={styles.iconButtonSpacer} />
            )}
            {step && total ? <Progress step={step} total={total} /> : <View style={styles.flex} />}
            {onSkip ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={skipLabel}
                onPress={onSkip}
                style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
              >
                <Text style={[styles.skipText, dark && styles.skipTextDark]}>{skipLabel}</Text>
              </Pressable>
            ) : (
              <View style={styles.iconButtonSpacer} />
            )}
          </View>
        ) : null}

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scroll, fill && styles.scrollFill]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={[styles.stage, fill && styles.flex]}>
              <View style={[styles.inner, fill && styles.flex]}>
                {above}
                {roy ? (
                  <View style={[styles.royStage, { height: roy.size ?? 220 }, !fill && styles.royStageTight]}>
                    {dark ? (
                      <Animated.View entering={reduced ? undefined : FadeIn.duration(700)} style={styles.glow}>
                        <RoyGlow size={(roy.size ?? 220) * 1.5} />
                      </Animated.View>
                    ) : null}
                    <Roy
                      pose={roy.pose}
                      still={!roy.state}
                      autoIdle={false}
                      state={roy.state}
                      onComplete={roy.onComplete}
                      size={roy.size ?? 220}
                      scene={dark ? 'dark' : 'light'}
                      decorative={roy.decorative !== false}
                    />
                  </View>
                ) : null}
                {fill ? <View style={styles.flex} /> : null}
                <Animated.View
                  key={stepKey}
                  entering={reduced || !stepKey ? undefined : FadeInDown.duration(260).easing(Easing.out(Easing.cubic))}
                  style={fill ? styles.copyBlock : undefined}
                >
                  {eyebrow ? <Text style={[styles.eyebrow, dark && styles.eyebrowDark]}>{eyebrow}</Text> : null}
                  {title ? (
                    <Text maxFontSizeMultiplier={1.35} style={[styles.title, dark && styles.titleDark]}>
                      {title}
                    </Text>
                  ) : null}
                  {subtitle ? (
                    <Text maxFontSizeMultiplier={1.4} style={[styles.subtitle, dark && styles.subtitleDark]}>
                      {subtitle}
                    </Text>
                  ) : null}
                </Animated.View>
                {children ? (
                  <Animated.View
                    key={`body-${stepKey}`}
                    entering={reduced || !stepKey ? undefined : FadeInDown.delay(70).duration(280).easing(Easing.out(Easing.cubic))}
                    style={styles.body}
                  >
                    {children}
                  </Animated.View>
                ) : null}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
  iconButtonSpacer: { width: 44, height: 44 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.mintDeep, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2, backgroundColor: colors.ink },
  skip: { minHeight: 44, maxWidth: 148, alignItems: 'flex-end', justifyContent: 'center', paddingLeft: 8 },
  skipText: { color: colors.stone, fontSize: 13, textAlign: 'right', ...typography.label },
  skipTextDark: { color: 'rgba(255,255,255,0.78)' },
  pressed: { opacity: 0.7 },
  scroll: { flexGrow: 1, paddingTop: 8, paddingBottom: 16 },
  scrollFill: { flexGrow: 1 },
  stage: { flexGrow: 1, justifyContent: 'center' },
  body: { marginTop: 18, gap: 0 },
  inner: { width: '100%', maxWidth: layout.flowWidth, alignSelf: 'center', paddingHorizontal: 22 },
  royStage: { alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, marginBottom: -8 },
  royStageTight: { marginBottom: 10 },
  glow: { position: 'absolute', alignSelf: 'center', bottom: -20 },
  copyBlock: { paddingBottom: 8 },
  eyebrow: { color: colors.greenBright, fontSize: 11, marginBottom: 6, ...typography.label, letterSpacing: 1.6 },
  eyebrowDark: { color: colors.mintDeep },
  title: { color: colors.ink, fontSize: 28, lineHeight: 34, ...typography.pageTitle },
  titleDark: { color: colors.white, fontSize: 36, lineHeight: 40, ...typography.numeric },
  subtitle: { color: colors.stone, fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 360, ...typography.body },
  subtitleDark: { color: 'rgba(255,255,255,0.78)' },
  footer: {
    paddingTop: 8,
    paddingBottom: Platform.OS === 'web' ? 20 : 8,
  },
});
