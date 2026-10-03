import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, EmptyState, Screen } from '@/components/ui';
import { safeBack } from '@/lib/nav';
import { colors, spacing, tints, typography, type TintName } from '@/theme/tokens';

/** One look for every account screen: a title bar, then rounded cards of icon rows. */
export function AccountScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Screen>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => safeBack('/(tabs)/profile')} style={styles.back}>
          <Ionicons name="arrow-back" size={21} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{title}</Text>
      </View>
      {children}
    </Screen>
  );
}

export function SignInGate({ title }: { title: string }) {
  return (
    <AccountScreen title={title}>
      <EmptyState
        pose="wave"
        title="Sign in to see this"
        message="This is part of your account. It takes a minute to set up."
        action={<Button label="Create account or sign in" onPress={() => router.push('/onboarding')} />}
      />
    </AccountScreen>
  );
}

export function SettingsCard({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <View style={styles.group}>
      {title ? <Text style={styles.groupTitle}>{title}</Text> : null}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export function SettingRow({
  icon,
  tint = 'mint',
  label,
  detail,
  value,
  last,
  toggle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint?: TintName;
  label: string;
  detail?: string;
  value?: string;
  last?: boolean;
  /** Shows a switch. `locked` keeps it on and unchangeable. */
  toggle?: { on: boolean; onChange?: (next: boolean) => void; locked?: boolean };
  onPress?: () => void;
}) {
  const scheme = tints[tint];
  const body = (
    <>
      <View style={[styles.icon, { backgroundColor: scheme.bg }]}>
        <Ionicons accessible={false} name={icon} size={18} color={scheme.accent} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        {value ? <Text selectable style={styles.value}>{value}</Text> : null}
      </View>
      {toggle ? (
        <Switch
          accessibilityLabel={label}
          value={toggle.on}
          disabled={toggle.locked}
          onValueChange={toggle.onChange}
          trackColor={{ true: colors.ink, false: colors.mintDeep }}
          thumbColor={colors.white}
        />
      ) : onPress ? (
        <Ionicons accessible={false} name="chevron-forward" size={18} color={colors.stone} />
      ) : null}
    </>
  );
  const style = [styles.row, !last && styles.divider];
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={style}>{body}</Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <Text style={styles.note}>{children}</Text>;
}

const styles = StyleSheet.create({
  top: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: 6 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: colors.ink, fontSize: 22, ...typography.pageTitle },
  group: { marginTop: 10 },
  groupTitle: { color: colors.stone, fontSize: 11, marginBottom: 6, marginLeft: 6, ...typography.label, letterSpacing: 1.1, textTransform: 'uppercase' },
  card: { borderRadius: 22, backgroundColor: colors.paper, paddingHorizontal: 14, overflow: 'hidden' },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  label: { color: colors.ink, fontSize: 15, ...typography.heading },
  detail: { color: colors.stone, fontSize: 12, lineHeight: 17, marginTop: 1, ...typography.body },
  value: { color: colors.charcoal, fontSize: 14, marginTop: 1, ...typography.body },
  note: { color: colors.stone, fontSize: 12, lineHeight: 18, marginTop: 12, paddingHorizontal: 6, ...typography.body },
});

