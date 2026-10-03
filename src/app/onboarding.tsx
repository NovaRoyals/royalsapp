import { Ionicons } from '@expo/vector-icons';
import { Href, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Wordmark } from '@/components/brand/Wordmark';
import { FlowShell } from '@/components/onboarding/FlowShell';
import { ChoiceCard, FlowField, OrRule, ProviderButton, type Tint } from '@/components/onboarding/Pieces';
import { Button } from '@/components/ui';
import { RELATIONSHIP_TO_ROLE } from '@/lib/greeting';
import { haptic } from '@/lib/haptics';
import { leaveOnboarding, safeBack } from '@/lib/nav';
import { useReducedMotion } from '@/lib/reducedMotion';
import { defaultNotificationPrefs, useApp } from '@/state/AppProvider';
import { colors, radius, typography } from '@/theme/tokens';
import type { AuthProvider, ClubRelationship } from '@/types/domain';

type Step = 'welcome' | 'account' | 'email' | 'identity' | 'role';
type ProviderStatus = 'idle' | 'loading' | 'error';

const ROLE_CHOICES: {
  id: ClubRelationship;
  icon: keyof typeof Ionicons.glyphMap;
  tint: Tint;
  title: string;
  detail: string;
}[] = [
  { id: 'parent', icon: 'people-outline', tint: 'amber', title: 'Parent or guardian', detail: 'Sign up your kids and keep track of their Sundays.' },
  { id: 'player', icon: 'football-outline', tint: 'green', title: 'Adult player', detail: 'Find your Open, 35+, women’s or cricket side.' },
  { id: 'supporter', icon: 'heart-outline', tint: 'rose', title: 'Supporter or volunteer', detail: 'Cheer on the matches and lend a hand around the club.' },
  { id: 'coach', icon: 'clipboard-outline', tint: 'blue', title: 'Coach', detail: 'Request staff access. Tools unlock once an admin assigns you.' },
  { id: 'manager', icon: 'briefcase-outline', tint: 'teal', title: 'Team manager', detail: 'Request operations access. An admin assigns it.' },
];

const PROVIDER_IDENTITY: Record<Exclude<AuthProvider, 'email'>, { firstName: string; lastName: string; email: string }> = {
  google: { firstName: 'Jordan', lastName: 'Cole', email: 'jordan.cole@gmail.com' },
  apple: { firstName: 'Jordan', lastName: 'Cole', email: 'jordan.cole@icloud.com' },
};

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ mode?: string; returnTo?: string }>();
  const { completeOnboarding, completeIntro, introCompleted } = useApp();
  const reduced = useReducedMotion();
  const signInIntent = params.mode === 'signin';
  const returnTo = (params.returnTo as Href | undefined) ?? '/(tabs)';

  const [step, setStep] = useState<Step>(signInIntent || introCompleted ? 'account' : 'welcome');
  const [intent, setIntent] = useState<'create' | 'signin'>(signInIntent ? 'signin' : 'create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nameError, setNameError] = useState('');
  const [provider, setProvider] = useState<AuthProvider | null>(null);
  const [photoOn, setPhotoOn] = useState(false);
  const [busyProvider, setBusyProvider] = useState<Exclude<AuthProvider, 'email'> | null>(null);
  const [providerError, setProviderError] = useState('');
  const [roleChoice, setRoleChoice] = useState<ClubRelationship | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const connectGen = useRef(0);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  const progress =
    step === 'account' || step === 'email'
      ? { step: 1, total: 3 }
      : step === 'identity'
        ? { step: 2, total: 3 }
        : step === 'role'
          ? { step: 3, total: 3 }
          : undefined;

  const guest = () => {
    completeIntro();
    leaveOnboarding('/(tabs)');
  };

  const back = () => {
    if (advancing) return;
    if (step === 'email') return setStep('account');
    if (step === 'identity') return setStep(provider === 'email' ? 'email' : 'account');
    if (step === 'role') return setStep('identity');
    if (step === 'account') {
      if (introCompleted) return safeBack('/(tabs)');
      return setStep('welcome');
    }
    if (introCompleted) return safeBack('/(tabs)');
  };

  const finish = (choice: ClubRelationship) => {
    if (advancing) return;
    setAdvancing(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    completeOnboarding({
      role: RELATIONSHIP_TO_ROLE[choice],
      relationship: choice,
      children: [],
      followedIds: [],
      notificationPrefs: defaultNotificationPrefs,
      guardianName: fullName,
      email: email.trim(),
      pendingStaffRole: choice === 'coach' ? 'coach' : choice === 'manager' ? 'competition_manager' : null,
    });
    leaveOnboarding(returnTo);
  };

  const applyProvider = (next: Exclude<AuthProvider, 'email'>) => {
    const identity = PROVIDER_IDENTITY[next];
    setProvider(next);
    setFirstName(identity.firstName);
    setLastName(identity.lastName);
    setEmail(identity.email);
    setPhotoOn(true);
    setProviderError('');
    setBusyProvider(null);
    setStep('identity');
  };

  const connectProvider = (next: Exclude<AuthProvider, 'email'>) => {
    if (advancing || busyProvider) return;
    setProviderError('');
    if (next === 'apple' && process.env.EXPO_OS !== 'ios') {
      setProviderError('Apple sign-in isn’t available here. Try Google or email.');
      return;
    }
    const token = ++connectGen.current;
    setBusyProvider(next);
    const timer = setTimeout(() => {
      if (connectGen.current !== token) return;
      applyProvider(next);
    }, 420);
    return () => clearTimeout(timer);
  };

  const cancelProvider = () => {
    connectGen.current += 1;
    setBusyProvider(null);
    setProviderError('Google sign-in was cancelled.');
  };

  const submitEmail = () => {
    const nextEmail = email.trim();
    const mailOk = isEmail(nextEmail);
    const passOk = password.trim().length >= 8;
    setEmailError(mailOk ? '' : 'Enter a valid email address.');
    setPasswordError(passOk ? '' : 'Use at least 8 characters.');
    if (!mailOk || !passOk) return;
    setProvider('email');
    setPhotoOn(false);
    setStep('identity');
  };

  const submitIdentity = () => {
    if (!firstName.trim()) {
      setNameError('Enter the name we should use.');
      return;
    }
    setNameError('');
    setStep('role');
  };

  const pickRole = (choice: ClubRelationship) => {
    if (advancing) return;
    setRoleChoice(choice);
    haptic('light');
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    const delay = reduced ? 80 : 280;
    advanceTimer.current = setTimeout(() => finish(choice), delay);
  };

  const statusFor = (id: Exclude<AuthProvider, 'email'>): ProviderStatus => {
    if (busyProvider === id) return 'loading';
    if (providerError && ((id === 'google' && providerError.startsWith('Google')) || (id === 'apple' && providerError.startsWith('Apple')))) {
      return 'error';
    }
    return 'idle';
  };

  if (step === 'welcome') {
    return (
      <FlowShell
        tone="dark"
        fill
        above={<Wordmark light />}
        stepKey="welcome"
        roy={{ pose: 'excited', size: 268, decorative: true }}
        title={'Same Lion.\nBigger Tomorrows.'}
        subtitle="Soccer, cricket, kids and community. Come play, cheer, or help out."
        footer={
          <>
            <Button label="Get started" variant="light" onPress={() => { setIntent('create'); setStep('account'); }} />
            <Pressable accessibilityRole="button" onPress={guest} style={styles.secondaryDark}>
              <Text style={styles.secondaryDarkText}>Explore the club</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setIntent('signin'); setStep('account'); }} style={styles.quiet}>
              <Text style={styles.quietText}>
                Already have an account? <Text style={styles.quietStrong}>Sign in</Text>
              </Text>
            </Pressable>
          </>
        }
      />
    );
  }

  if (step === 'account') {
    return (
      <FlowShell
        onBack={back}
        onSkip={introCompleted ? undefined : guest}
        stepKey="account"
        step={progress?.step}
        total={progress?.total}
        roy={{ pose: 'smile', size: 120, decorative: true }}
        title={intent === 'signin' ? 'Welcome back' : 'Let’s get you in'}
        subtitle={intent === 'signin' ? 'Sign in the way you did last time.' : 'Use an account you already have, or sign up with email. It takes a minute.'}
      >
        <ProviderButton
          icon="logo-google"
          label="Continue with Google"
          color={colors.danger}
          status={statusFor('google')}
          onPress={() => connectProvider('google')}
          onCancel={cancelProvider}
        />
        {process.env.EXPO_OS === 'ios' || Platform.OS === 'web' ? (
          <ProviderButton
            icon="logo-apple"
            label="Continue with Apple"
            color={colors.ink}
            status={statusFor('apple')}
            onPress={() => connectProvider('apple')}
          />
        ) : null}
        {providerError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{providerError}</Text>
            <Pressable accessibilityRole="button" onPress={() => { setProviderError(''); connectProvider('google'); }}>
              <Text style={styles.retry}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
        <OrRule />
        <Pressable accessibilityRole="button" onPress={() => setStep('email')} style={styles.quiet}>
          <Text style={styles.inlineLink}>{intent === 'signin' ? 'Sign in with email' : 'Sign up with email'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setIntent(intent === 'signin' ? 'create' : 'signin')} style={styles.quiet}>
          <Text style={styles.inlineMuted}>
            {intent === 'signin' ? 'New here? ' : 'Already have an account? '}
            <Text style={styles.inlineStrong}>{intent === 'signin' ? 'Create one' : 'Sign in'}</Text>
          </Text>
        </Pressable>
      </FlowShell>
    );
  }

  if (step === 'email') {
    return (
      <FlowShell
        onBack={back}
        onSkip={introCompleted ? undefined : guest}
        step={progress?.step}
        total={progress?.total}
        stepKey="email"
        title={intent === 'signin' ? 'Sign in with email' : 'Sign up with email'}
        subtitle="Use an email you check. You can change it later."
        footer={<Button label="Continue" onPress={submitEmail} />}
      >
        <FlowField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          error={emailError}
          onBlur={() => setEmailError(email.trim() && !isEmail(email) ? 'Enter a valid email address.' : '')}
        />
        <FlowField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          secureTextEntry
          autoComplete="password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submitEmail}
          error={passwordError}
          onBlur={() => setPasswordError(password.length > 0 && password.length < 8 ? 'Use at least 8 characters.' : '')}
        />
      </FlowShell>
    );
  }

  if (step === 'identity') {
    const initials = `${firstName.trim()[0] ?? ''}${lastName.trim()[0] ?? ''}`.toUpperCase();
    return (
      <FlowShell
        onBack={back}
        step={progress?.step}
        total={progress?.total}
        stepKey="identity"
        roy={{ pose: 'wink', size: 140, decorative: true }}
        title="Nice to meet you. What should we call you?"
        subtitle={email ? `Signed in as ${email}` : 'You can change this later in Profile.'}
        footer={<Button label="Continue" onPress={submitIdentity} />}
      >
        <View style={styles.photoRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{photoOn ? initials || 'JC' : initials || 'NR'}</Text>
            </View>
          <View style={styles.flex}>
            <Text style={styles.photoLabel}>{photoOn ? 'Photo from your account' : 'No profile photo yet'}</Text>
            <View style={styles.photoActions}>
              <Pressable accessibilityRole="button" onPress={() => setPhotoOn(true)} style={styles.photoBtn}>
                <Text style={styles.photoBtnText}>Change</Text>
              </Pressable>
              {photoOn ? (
                <Pressable accessibilityRole="button" onPress={() => setPhotoOn(false)} style={styles.photoBtn}>
                  <Text style={styles.photoBtnText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
        <FlowField
          label="Full name"
          value={`${firstName}${lastName ? ` ${lastName}` : ''}`.replace(/^\s/, '')}
          onChangeText={(value) => {
            const parts = value.trimStart().split(/\s+/);
            setFirstName(parts[0] ?? '');
            setLastName(parts.slice(1).join(' '));
          }}
          placeholder="Jordan Cole"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          error={nameError}
          onBlur={() => setNameError(firstName.trim() ? '' : nameError)}
        />
      </FlowShell>
    );
  }

  return (
    <FlowShell
      onBack={back}
      stepKey="role"
      step={progress?.step}
      total={progress?.total}
      roy={{ pose: 'point', size: 128, decorative: true }}
      title="Who’s joining the club?"
      subtitle="This shapes your Home. You can add more roles any time."
    >
      {ROLE_CHOICES.map((choice, index) => (
        <Animated.View
          key={choice.id}
          entering={reduced ? undefined : FadeInDown.delay(120 + index * 55).duration(260).easing(Easing.out(Easing.cubic))}
        >
          <ChoiceCard
            icon={choice.icon}
            tint={choice.tint}
            title={choice.title}
            detail={choice.detail}
            selected={roleChoice === choice.id}
            onPress={() => pickRole(choice.id)}
          />
        </Animated.View>
      ))}
    </FlowShell>
  );
}

const styles = StyleSheet.create({
  secondaryDark: {
    minHeight: 54,
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryDarkText: { color: colors.white, fontSize: 15, ...typography.label },
  quiet: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  quietText: { color: 'rgba(255,255,255,0.72)', fontSize: 13, ...typography.body },
  quietStrong: { color: colors.white, ...typography.label },
  inlineLink: { color: colors.ink, textAlign: 'center', fontSize: 15, ...typography.label },
  inlineMuted: { color: colors.stone, textAlign: 'center', fontSize: 13, ...typography.body },
  inlineStrong: { color: colors.ink, ...typography.label },
  errorBox: { padding: 12, borderRadius: radius.card, backgroundColor: colors.dangerSoft, marginBottom: 8, gap: 6 },
  errorText: { color: colors.danger, fontSize: 13, ...typography.body },
  retry: { color: colors.ink, fontSize: 13, ...typography.label },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: { color: colors.ink, fontSize: 18, ...typography.heading },
  photoLabel: { color: colors.ink, fontSize: 14, ...typography.heading },
  photoActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  photoBtn: { minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' },
  photoBtnText: { color: colors.ink, fontSize: 13, ...typography.label },
  flex: { flex: 1 },
});
