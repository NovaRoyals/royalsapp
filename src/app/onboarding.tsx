import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Button, Field, Screen } from '@/components/ui';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { UserRole } from '@/types/domain';

const choices: { role: UserRole; label: string; detail: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { role: 'adult_player', label: 'Player', detail: 'Join teams and manage availability', icon: 'football-outline' },
  { role: 'guardian', label: 'Parent / guardian', detail: 'Register and manage children', icon: 'people-outline' },
  { role: 'coach', label: 'Coach / manager', detail: 'Support a team or squad', icon: 'clipboard-outline' },
  { role: 'guest', label: 'Other / supporter', detail: 'Follow programs and club news', icon: 'heart-outline' },
];

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { setRole } = useApp();
  const [mode, setMode] = useState<'welcome' | 'signup' | 'signin'>(params.mode === 'signin' ? 'signin' : 'welcome');
  const [role, setSelectedRole] = useState<UserRole>('guardian');
  const [profileStep, setProfileStep] = useState(false);

  const finish = () => {
    setRole(role);
    router.replace('/(tabs)');
  };

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.brandRow}>
        <Brand />
        <Pressable accessibilityLabel="Close" onPress={() => router.back()} style={styles.close}><Ionicons name="close" size={21} /></Pressable>
      </View>

      {mode === 'welcome' && (
        <View style={styles.center}>
          <View style={styles.mark}><Text style={styles.markText}>R</Text></View>
          <Text style={styles.title}>Your club.{'\n'}Your season.</Text>
          <Text style={styles.body}>Find a program, register your family and stay close to every Royals team.</Text>
          <View style={styles.actions}>
            <Button label="Create account" onPress={() => setMode('signup')} />
            <Button label="Sign in" variant="secondary" onPress={() => setMode('signin')} />
            <Button label="Continue as guest" variant="ghost" onPress={() => { setRole('guest'); router.replace('/(tabs)'); }} />
          </View>
        </View>
      )}

      {mode === 'signup' && !profileStep && (
        <View style={styles.form}>
          <Text style={styles.eyebrow}>STEP 1 OF 2</Text>
          <Text style={styles.formTitle}>Create your account</Text>
          <Text style={styles.formBody}>Keep this short. Your player or household details come next.</Text>
          <Field label="Full name" placeholder="Your name" autoCapitalize="words" />
          <Field label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Password" placeholder="At least 8 characters" secureTextEntry />
          <Button label="Continue" icon="arrow-forward" onPress={() => setProfileStep(true)} />
          <Text style={styles.demoNote}>Demo mode accepts any details and stores no password. Supabase Auth activates when environment variables are configured.</Text>
        </View>
      )}

      {mode === 'signup' && profileStep && (
        <View style={styles.form}>
          <Text style={styles.eyebrow}>STEP 2 OF 2</Text>
          <Text style={styles.formTitle}>What best describes you?</Text>
          <Text style={styles.formBody}>This sets your starting experience. You can follow any sport or program later.</Text>
          <View style={styles.choices}>
            {choices.map((choice) => {
              const active = role === choice.role;
              return (
                <Pressable key={choice.role} onPress={() => setSelectedRole(choice.role)} style={[styles.choice, active && styles.choiceActive]}>
                  <View style={[styles.choiceIcon, active && styles.choiceIconActive]}><Ionicons name={choice.icon} size={21} color={active ? colors.white : colors.orangeDark} /></View>
                  <View style={styles.flex}><Text style={styles.choiceLabel}>{choice.label}</Text><Text style={styles.choiceDetail}>{choice.detail}</Text></View>
                  <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? colors.orange : colors.stone} />
                </Pressable>
              );
            })}
          </View>
          <Button label={role === 'guardian' ? 'Continue & add a child' : role === 'adult_player' ? 'Continue & complete profile' : 'Finish setup'} icon="arrow-forward" onPress={finish} />
          <Text style={styles.progressive}>You can skip detailed profile fields for now and complete them when you register.</Text>
        </View>
      )}

      {mode === 'signin' && (
        <View style={styles.form}>
          <Text style={styles.eyebrow}>WELCOME BACK</Text>
          <Text style={styles.formTitle}>Sign in to ROYALS</Text>
          <Text style={styles.formBody}>Your teams, family and schedule are waiting.</Text>
          <Field label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Password" placeholder="Your password" secureTextEntry />
          <Pressable><Text style={styles.forgot}>Forgot password?</Text></Pressable>
          <Button label="Sign in" onPress={() => { setRole('guardian'); router.replace('/(tabs)'); }} />
          <Button label="Create an account" variant="ghost" onPress={() => setMode('signup')} />
          <Text style={styles.demoNote}>Demo mode signs in to a seeded parent account. No credentials are transmitted.</Text>
        </View>
      )}
    </Screen>
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
  form: { marginTop: spacing.xxxl, paddingBottom: spacing.xxxl },
  eyebrow: { color: colors.orangeDark, fontSize: 10, ...typography.label, letterSpacing: 1.2 },
  formTitle: { color: colors.ink, fontSize: 31, marginTop: spacing.sm, ...typography.heading },
  formBody: { color: colors.stone, fontSize: 14, lineHeight: 21, marginTop: spacing.sm, marginBottom: spacing.xl, ...typography.body },
  demoNote: { color: colors.warning, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: spacing.lg, ...typography.body },
  choices: { gap: spacing.sm, marginBottom: spacing.xl },
  choice: { minHeight: 74, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  choiceActive: { borderColor: colors.orange, backgroundColor: colors.orangeSoft },
  choiceIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  choiceIconActive: { backgroundColor: colors.orange },
  flex: { flex: 1 },
  choiceLabel: { color: colors.ink, fontSize: 14, ...typography.heading },
  choiceDetail: { color: colors.stone, fontSize: 11, marginTop: 2, ...typography.body },
  progressive: { color: colors.stone, fontSize: 10, textAlign: 'center', marginTop: spacing.md, ...typography.body },
  forgot: { color: colors.orangeDark, fontSize: 12, textAlign: 'right', marginTop: -spacing.sm, marginBottom: spacing.lg, ...typography.label },
});
