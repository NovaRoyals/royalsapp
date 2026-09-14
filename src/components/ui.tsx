import { Ionicons } from '@expo/vector-icons';
import { Link, type Href, usePathname } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TabScene } from '@/components/motion';
import { haptic } from '@/lib/haptics';
import { notificationsForRole } from '@/lib/membership';
import { useReducedMotion } from '@/lib/reducedMotion';
import { backendModeLabel } from '@/lib/supabase';
import { useApp } from '@/state/AppProvider';
import { motion } from '@/theme/motion';
import { colors, layout, radius, shadow, spacing, typography } from '@/theme/tokens';

export function Screen({
  children,
  scroll = true,
  style,
  contentStyle,
  scrollKey,
  tabScene = false,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  scrollKey?: string | number;
  tabScene?: boolean;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const pathname = usePathname();
  const resetKey = scrollKey ?? pathname;

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 60);
    return () => clearTimeout(timer);
  }, [resetKey]);

  const content = <View style={[styles.content, contentStyle]}>{children}</View>;
  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={Platform.OS === 'web' ? ({ overflowAnchor: 'none' } as ViewStyle) : undefined}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {content}
    </ScrollView>
  ) : (
    content
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, style]}>
      {tabScene ? <TabScene>{body}</TabScene> : body}
    </SafeAreaView>
  );
}

export function Brand({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <View accessibilityLabel="ROYALS" style={styles.brand}>
      <View style={[styles.crown, light && styles.crownLight]}>
        <Text style={[styles.crownText, light && { color: colors.ink }]}>R</Text>
      </View>
      {!compact && <Text style={[styles.brandText, light && { color: colors.white }]}>ROYALS</Text>}
    </View>
  );
}

export function AppHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title?: string;
  action?: React.ReactNode;
}) {
  const { hydrated, notifications, role } = useApp();
  const unread = hydrated ? notificationsForRole(role, notifications).filter((item) => !item.read).length : 0;
  const reduced = useReducedMotion();
  return (
    <View style={styles.header}>
      <View>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : <Brand />}
        {title ? <Text style={styles.headerTitle}>{title}</Text> : null}
      </View>
      {action ?? (
        <Link href={'/notifications' as Href} asChild>
          <Pressable
            accessibilityLabel="Open notifications"
            style={({ pressed }) => [styles.iconButton, pressed && !reduced && styles.pressed]}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.ink} />
            {unread > 0 ? <View style={styles.notificationDot} /> : null}
          </Pressable>
        </Link>
      )}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'dark' | 'ghost';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        pressed && !reduced && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'dark' ? colors.white : colors.ink} />
      ) : (
        <>
          <Text style={[styles.buttonLabel, styles[`buttonLabel_${variant}`]]}>{label}</Text>
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={variant === 'primary' || variant === 'dark' ? colors.white : colors.ink}
            />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

export function SectionHeading({
  title,
  actionLabel,
  href,
}: {
  title: string;
  actionLabel?: string;
  href?: Href;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && href ? (
        <Link href={href} style={styles.sectionAction}>
          {actionLabel}
        </Link>
      ) : null}
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  tone = 'neutral',
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: 'neutral' | 'orange' | 'success';
}) {
  const reduced = useReducedMotion();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        if (!onPress) return;
        if (!active) haptic('light');
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        tone === 'orange' && styles.chipOrange,
        tone === 'success' && styles.chipSuccess,
        active && styles.chipActive,
        pressed && !reduced && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  ...props
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.stone}
        style={[styles.field, Boolean(error) && styles.fieldError]}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : hint ? <Text style={styles.hintText}>{hint}</Text> : null}
    </View>
  );
}

export function StatusPill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'orange';
}) {
  return (
    <View style={[styles.status, styles[`status_${tone}`]]}>
      <Text style={[styles.statusText, styles[`statusText_${tone}`]]}>{label}</Text>
    </View>
  );
}

export function DemoBadge() {
  return (
    <View style={styles.demoBadge}>
      <View style={styles.demoDot} />
      <Text style={styles.demoText}>{backendModeLabel}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={28} color={colors.orange} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  scroll: { flexGrow: 1, paddingBottom: 108 },
  content: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: layout.contentPadding },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  crown: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
  },
  crownLight: { backgroundColor: colors.orange },
  crownText: { color: colors.orange, fontSize: 21, ...typography.display },
  brandText: { color: colors.ink, fontSize: 21, ...typography.display, letterSpacing: 2.5 },
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: { color: colors.orangeDark, textTransform: 'uppercase', fontSize: 11, ...typography.label, letterSpacing: 1.4 },
  headerTitle: { color: colors.ink, fontSize: 30, marginTop: 3, ...typography.heading },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
  },
  notificationDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.orange,
    position: 'absolute',
    right: 10,
    top: 9,
    borderWidth: 1,
    borderColor: colors.paper,
  },
  button: {
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button_primary: { backgroundColor: colors.orange },
  button_secondary: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  button_dark: { backgroundColor: colors.ink },
  button_ghost: { backgroundColor: 'transparent' },
  buttonLabel: { fontSize: 15, ...typography.label },
  buttonLabel_primary: { color: colors.white },
  buttonLabel_secondary: { color: colors.ink },
  buttonLabel_dark: { color: colors.white },
  buttonLabel_ghost: { color: colors.ink },
  pressed: { opacity: motion.press.opacity, transform: [{ scale: motion.press.scale }] },
  disabled: { opacity: 0.45 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  sectionTitle: { color: colors.ink, fontSize: 21, ...typography.heading },
  sectionAction: { color: colors.orangeDark, fontSize: 13, ...typography.label },
  chip: {
    minHeight: 38,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
  },
  chipOrange: { backgroundColor: colors.orangeSoft, borderColor: colors.orangeSoft },
  chipSuccess: { backgroundColor: colors.successSoft, borderColor: colors.successSoft },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.charcoal, fontSize: 13, ...typography.label },
  chipTextActive: { color: colors.white },
  fieldWrap: { gap: 6, marginBottom: spacing.lg },
  fieldLabel: { color: colors.charcoal, fontSize: 13, ...typography.label },
  field: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 15,
    backgroundColor: colors.paper,
    color: colors.ink,
    fontSize: 16,
    ...typography.body,
  },
  fieldError: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: 12, ...typography.body },
  hintText: { color: colors.stone, fontSize: 12, ...typography.body },
  status: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  status_neutral: { backgroundColor: colors.sand },
  status_success: { backgroundColor: colors.successSoft },
  status_warning: { backgroundColor: colors.warningSoft },
  status_danger: { backgroundColor: colors.dangerSoft },
  status_orange: { backgroundColor: colors.orangeSoft },
  statusText: { fontSize: 11, textTransform: 'uppercase', ...typography.label },
  statusText_neutral: { color: colors.charcoal },
  statusText_success: { color: colors.success },
  statusText_warning: { color: colors.warning },
  statusText_danger: { color: colors.danger },
  statusText_orange: { color: colors.orangeDark },
  demoBadge: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  demoDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.warning },
  demoText: { color: colors.stone, fontSize: 11, ...typography.label },
  empty: {
    padding: spacing.xxl,
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.paper,
    ...shadow,
  },
  emptyTitle: { marginTop: spacing.md, color: colors.ink, fontSize: 17, ...typography.heading },
  emptyMessage: { marginTop: spacing.xs, textAlign: 'center', color: colors.stone, lineHeight: 20, ...typography.body },
});

export const textStyles = StyleSheet.create({
  display: { color: colors.ink, fontSize: 40, lineHeight: 43, ...typography.display } as TextStyle,
  h1: { color: colors.ink, fontSize: 32, lineHeight: 37, ...typography.heading } as TextStyle,
  h2: { color: colors.ink, fontSize: 23, lineHeight: 29, ...typography.heading } as TextStyle,
  h3: { color: colors.ink, fontSize: 17, lineHeight: 22, ...typography.heading } as TextStyle,
  body: { color: colors.charcoal, fontSize: 15, lineHeight: 22, ...typography.body } as TextStyle,
  muted: { color: colors.stone, fontSize: 14, lineHeight: 20, ...typography.body } as TextStyle,
  label: { color: colors.charcoal, fontSize: 12, textTransform: 'uppercase', ...typography.label } as TextStyle,
});
