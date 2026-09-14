import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Button, Field, Screen } from '@/components/ui';
import { followCatalog } from '@/data/demo';
import { defaultNotificationPrefs, useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { NotificationPrefs, Person, UserRole } from '@/types/domain';

const choices: { role: UserRole; label: string; detail: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { role: 'guardian', label: 'Parent', detail: 'Register children and follow their season', icon: 'people-outline' },
  { role: 'adult_player', label: 'Player', detail: 'Join teams and manage availability', icon: 'football-outline' },
  { role: 'coach', label: 'Coach', detail: 'Attendance, announcements, your squad', icon: 'clipboard-outline' },
  { role: 'volunteer', label: 'Volunteer', detail: 'Help match days and club events', icon: 'heart-outline' },
];

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { setRole, completeOnboarding, household } = useApp();
  const [mode, setMode] = useState<'welcome' | 'signup' | 'signin' | 'setup'>(params.mode === 'signin' ? 'signin' : 'welcome');
  const [role, setSelectedRole] = useState<UserRole>('guardian');
  const [setupStep, setSetupStep] = useState<'role' | 'children' | 'follow' | 'alerts'>('role');
  const [childFirst, setChildFirst] = useState('');
  const [childAge, setChildAge] = useState('');
  const [children, setChildren] = useState<Person[]>(household.children);
  const [followedIds, setFollowedIds] = useState<string[]>(['fall-kids-2026', 'nova-royals-men']);
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultNotificationPrefs);

  const finish = (nextRole = role) => {
    completeOnboarding({
      role: nextRole,
      children: nextRole === 'guardian' ? children : household.children,
      followedIds,
      notificationPrefs: { ...prefs, urgent: true },
    });
    router.replace('/(tabs)');
  };

  const addOnboardingChild = () => {
    if (!childFirst.trim()) return;
    const created: Person = {
      id: `child-${Date.now()}`,
      firstName: childFirst.trim(),
      lastName: household.guardianName.split(' ').slice(-1)[0] ?? 'Royals',
      displayName: childFirst.trim(),
      isMinor: true,
      dateOfBirth: childAge ? `${2026 - Number(childAge || '8')}-01-01` : undefined,
    };
    setChildren((current) => [...current, created]);
    setChildFirst('');
    setChildAge('');
  };

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.brandRow}>
        <Brand />
        <Pressable accessibilityLabel="Close" onPress={() => router.back()} style={styles.close}><Ionicons name="close-outline" size={21} /></Pressable>
      </View>

      {mode === 'welcome' && (
        <View style={styles.center}>
          <View style={styles.mark}><Text style={styles.markText}>R</Text></View>
          <Text style={styles.title}>Your club.{'\n'}Your season.</Text>
          <Text style={styles.body}>Tell ROYALS who you are so Home becomes your briefing—not a club brochure.</Text>
          <View style={styles.actions}>
            <Button label="Create account" onPress={() => setMode('signup')} />
            <Button label="Sign in" variant="secondary" onPress={() => setMode('signin')} />
            <Button label="Preview as parent" variant="ghost" onPress={() => finish('guardian')} />
            <Button label="Continue as guest" variant="ghost" onPress={() => { setRole('guest'); router.replace('/(tabs)'); }} />
          </View>
        </View>
      )}

      {mode === 'signup' && (
        <View style={styles.form}>
          <Text style={styles.eyebrow}>ACCOUNT</Text>
          <Text style={styles.formTitle}>Create your account</Text>
          <Text style={styles.formBody}>Demo mode stores no password. Household details come next.</Text>
          <Field label="Full name" placeholder="Your name" autoCapitalize="words" />
          <Field label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Password" placeholder="At least 8 characters" secureTextEntry />
          <Button label="Continue" icon="arrow-forward" onPress={() => setMode('setup')} />
        </View>
      )}

      {mode === 'setup' && setupStep === 'role' && (
        <View style={styles.form}>
          <Text style={styles.eyebrow}>STEP 1 OF 4</Text>
          <Text style={styles.formTitle}>Who are you at ROYALS?</Text>
          <View style={styles.choices}>
            {choices.map((choice) => {
              const active = role === choice.role;
              return (
                <Pressable key={choice.role} onPress={() => setSelectedRole(choice.role)} style={[styles.choice, active && styles.choiceActive]}>
                  <View style={[styles.choiceIcon, active && styles.choiceIconActive]}><Ionicons name={choice.icon} size={21} color={active ? colors.white : colors.orangeDark} /></View>
                  <View style={styles.flex}><Text style={styles.choiceLabel}>{choice.label}</Text><Text style={styles.choiceDetail}>{choice.detail}</Text></View>
                </Pressable>
              );
            })}
          </View>
          <Button label="Continue" icon="arrow-forward" onPress={() => setSetupStep(role === 'guardian' ? 'children' : 'follow')} />
        </View>
      )}

      {mode === 'setup' && setupStep === 'children' && (
        <View style={styles.form}>
          <Text style={styles.eyebrow}>STEP 2 OF 4</Text>
          <Text style={styles.formTitle}>Children & ages</Text>
          <Text style={styles.formBody}>Ages stay private. You can add more when you register.</Text>
          {children.map((child) => (
            <View key={child.id} style={styles.childRow}>
              <Text style={styles.choiceLabel}>{child.firstName}</Text>
              <Text style={styles.choiceDetail}>Birth date kept private</Text>
            </View>
          ))}
          <Field label="First name" value={childFirst} onChangeText={setChildFirst} />
          <Field label="Age (optional)" value={childAge} onChangeText={setChildAge} keyboardType="number-pad" hint="Never shown on public screens." />
          <Button label="Save child" variant="secondary" onPress={addOnboardingChild} />
          <Button label="Continue" icon="arrow-forward" onPress={() => setSetupStep('follow')} />
        </View>
      )}

      {mode === 'setup' && setupStep === 'follow' && (
        <View style={styles.form}>
          <Text style={styles.eyebrow}>STEP 3 OF 4</Text>
          <Text style={styles.formTitle}>What should Home follow?</Text>
          <Text style={styles.formBody}>Pick the teams and programs that belong in your briefing.</Text>
          {followCatalog.map((item) => {
            const active = followedIds.includes(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => setFollowedIds((current) => (current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]))}
                style={[styles.choice, active && styles.choiceActive]}
              >
                <View style={styles.flex}>
                  <Text style={styles.choiceLabel}>{item.label}</Text>
                  <Text style={styles.choiceDetail}>{item.detail}</Text>
                </View>
                <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={active ? colors.orange : colors.stone} />
              </Pressable>
            );
          })}
          <Button label="Continue" icon="arrow-forward" onPress={() => setSetupStep('alerts')} />
        </View>
      )}

      {mode === 'setup' && setupStep === 'alerts' && (
        <View style={styles.form}>
          <Text style={styles.eyebrow}>STEP 4 OF 4</Text>
          <Text style={styles.formTitle}>How should we reach you?</Text>
          <Text style={styles.formBody}>Urgent field closures always show in-app. Everything else follows these toggles.</Text>
          <PrefRow label="Urgent alerts" detail="Weather and field closures" locked value />
          <PrefRow label="Team & schedule" detail="Coach notes and time changes" value={prefs.team} onPress={() => setPrefs((current) => ({ ...current, team: !current.team }))} />
          <PrefRow label="Community" detail="This Week at ROYALS, volunteer asks" value={prefs.community} onPress={() => setPrefs((current) => ({ ...current, community: !current.community }))} />
          <Button label="Open my briefing" icon="arrow-forward" onPress={() => finish()} />
        </View>
      )}

      {mode === 'signin' && (
        <View style={styles.form}>
          <Text style={styles.eyebrow}>WELCOME BACK</Text>
          <Text style={styles.formTitle}>Sign in to ROYALS</Text>
          <Field label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Password" placeholder="Your password" secureTextEntry />
          <Button label="Sign in as parent" onPress={() => finish('guardian')} />
          <Button label="Create an account" variant="ghost" onPress={() => setMode('signup')} />
          <Text style={styles.demoNote}>Demo signs in to the seeded household. No credentials are transmitted.</Text>
        </View>
      )}
    </Screen>
  );
}

function PrefRow({ label, detail, value, onPress, locked }: { label: string; detail: string; value: boolean; onPress?: () => void; locked?: boolean }) {
  return (
    <Pressable onPress={locked ? undefined : onPress} style={styles.choice}>
      <View style={styles.flex}>
        <Text style={styles.choiceLabel}>{label}</Text>
        <Text style={styles.choiceDetail}>{detail}{locked ? ' · always on' : ''}</Text>
      </View>
      <Ionicons name={value ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={value ? colors.orange : colors.stone} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { minHeight: '100%' },
  brandRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, minHeight: 620, justifyContent: 'center', alignItems: 'center' },
  mark: { width: 96, height: 96, borderRadius: 27, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }], marginBottom: spacing.xxl },
  markText: { color: colors.orange, fontSize: 58, ...typography.display },
  title: { color: colors.ink, fontSize: 42, lineHeight: 44, textAlign: 'center', ...typography.display },
  body: { maxWidth: 380, color: colors.stone, fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: spacing.md, ...typography.body },
  actions: { width: '100%', gap: spacing.sm, marginTop: spacing.xxxl },
  form: { marginTop: spacing.xxl, paddingBottom: spacing.xxxl, gap: spacing.sm },
  eyebrow: { color: colors.orangeDark, fontSize: 10, ...typography.label, letterSpacing: 1.2 },
  formTitle: { color: colors.ink, fontSize: 31, marginTop: spacing.sm, ...typography.heading },
  formBody: { color: colors.stone, fontSize: 14, lineHeight: 21, marginTop: spacing.sm, marginBottom: spacing.lg, ...typography.body },
  demoNote: { color: colors.warning, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: spacing.lg, ...typography.body },
  choices: { gap: spacing.sm, marginBottom: spacing.lg },
  choice: { minHeight: 74, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  choiceActive: { borderColor: colors.orange, backgroundColor: colors.orangeSoft },
  choiceIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  choiceIconActive: { backgroundColor: colors.orange },
  flex: { flex: 1 },
  choiceLabel: { color: colors.ink, fontSize: 14, ...typography.heading },
  choiceDetail: { color: colors.stone, fontSize: 11, marginTop: 2, ...typography.body },
  childRow: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
});
