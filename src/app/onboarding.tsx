import { Ionicons } from '@expo/vector-icons';
import { Href, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Wordmark } from '@/components/brand/Wordmark';
import { FlowShell } from '@/components/onboarding/FlowShell';
import type { RoyPose } from '@/components/mascot/poses';
import { ChoiceCard, FlowField, OrRule, ProviderButton, type Tint } from '@/components/onboarding/Pieces';
import { Button } from '@/components/ui';
import { isEmail, passwordProblem } from '@/lib/authMessages';
import type { AccountUser } from '@/lib/authService';
import { RELATIONSHIP_TO_ROLE } from '@/lib/greeting';
import { haptic } from '@/lib/haptics';
import { leaveOnboarding, safeBack } from '@/lib/nav';
import { useReducedMotion } from '@/lib/reducedMotion';
import { isDemoMode } from '@/lib/supabase';
import { account } from '@/services/account';
import { useAccount } from '@/state/AccountProvider';
import { defaultNotificationPrefs, useApp } from '@/state/AppProvider';
import { colors, radius, typography } from '@/theme/tokens';
import type { AuthProvider, ClubRelationship } from '@/types/domain';

type Step = 'welcome' | 'account' | 'email' | 'identity' | 'role' | 'confirm';
type ProviderStatus = 'idle' | 'loading' | 'error';

const ROLE_CHOICES: {
  id: ClubRelationship;
  icon: keyof typeof Ionicons.glyphMap;
  tint: Tint;
  roy: RoyPose;
  title: string;
  detail: string;
}[] = [
  { id: 'parent', icon: 'people-outline', tint: 'amber', roy: 'happy', title: 'Parent or guardian', detail: 'Sign up your kids and keep track of their Sundays.' },
  { id: 'player', icon: 'football-outline', tint: 'green', roy: 'kick', title: 'Adult player', detail: 'Find your Open, 35+, women’s or cricket side.' },
  { id: 'supporter', icon: 'heart-outline', tint: 'rose', roy: 'celebrate', title: 'Supporter or volunteer', detail: 'Cheer on the matches and lend a hand around the club.' },
  { id: 'coach', icon: 'clipboard-outline', tint: 'blue', roy: 'think', title: 'Coach', detail: 'Request staff access. Tools unlock once an admin assigns you.' },
  { id: 'manager', icon: 'briefcase-outline', tint: 'teal', roy: 'idea', title: 'Team manager', detail: 'Request operations access. An admin assigns it.' },
];

const PROVIDER_IDENTITY: Record<Exclude<AuthProvider, 'email'>, { firstName: string; lastName: string; email: string }> = {
  google: { firstName: 'Jordan', lastName: 'Cole', email: 'jordan.cole@gmail.com' },
  apple: { firstName: 'Jordan', lastName: 'Cole', email: 'jordan.cole@icloud.com' },
};

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ mode?: string; returnTo?: string; from?: string }>();
  const { completeOnboarding, completeIntro, introCompleted } = useApp();
  const accountState = useAccount();
  const connected = !isDemoMode;
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
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const appliedUser = useRef<string | null>(null);
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
    if (step === 'confirm') return setStep('email');
    if (step === 'identity') return setStep(provider === 'email' ? 'email' : 'account');
    if (step === 'role') return setStep('identity');
    if (step === 'account') {
      if (introCompleted) return safeBack('/(tabs)');
      return setStep('welcome');
    }
    if (introCompleted) return safeBack('/(tabs)');
  };

  /** Put the person into the app on this device: their name, how they relate to the club, and where to land. */
  const completeLocally = (choice: ClubRelationship, first: string, last: string, mail: string) => {
    setAdvancing(true);
    completeOnboarding({
      role: RELATIONSHIP_TO_ROLE[choice],
      relationship: choice,
      children: [],
      followedIds: [],
      notificationPrefs: defaultNotificationPrefs,
      guardianName: `${first.trim()} ${last.trim()}`.trim(),
      email: mail.trim(),
      pendingStaffRole: choice === 'coach' ? 'coach' : choice === 'manager' ? 'competition_manager' : null,
    });
    leaveOnboarding(returnTo);
  };

  const finish = async (choice: ClubRelationship) => {
    if (advancing) return;
    if (!connected) return completeLocally(choice, firstName, lastName, email);

    setAdvancing(true);
    const stepBack = (to: Step, message: string) => {
      setAdvancing(false);
      setRoleChoice(null);
      setFormError(message);
      setStep(to);
    };
    if (provider === 'email' && !accountState.user) {
      const outcome = await account.signUp({ email, password, firstName, lastName, relationship: choice });
      if (!outcome.ok) return stepBack('email', outcome.message);
      if (outcome.status === 'confirm-email') {
        setAdvancing(false);
        setRoleChoice(null);
        setFormError('');
        setNotice('');
        return setStep('confirm');
      }
      if (outcome.status === 'signed-in') return completeLocally(choice, firstName, lastName, outcome.user.email || email);
      return stepBack('email', 'Something went wrong. Please try again.');
    }
    // Signed in already (Google, or an email link): keep the name and role as preferences on the account.
    await account.saveProfile({ firstName, lastName, relationship: choice });
    completeLocally(choice, firstName, lastName, email);
  };

  /** Someone has signed in. If we already know their name and role they are done; otherwise ask. */
  const applyAccount = (user: AccountUser, via: AuthProvider) => {
    setProvider(via);
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEmail(user.email);
    setPhotoOn(via === 'google');
    setFormError('');
    setProviderError('');
    setBusyProvider(null);
    if (user.firstName && user.relationship) {
      completeLocally(user.relationship, user.firstName, user.lastName, user.email);
      return;
    }
    setStep('identity');
  };

  // Coming back from a confirmation email or from Google: the account is signed in, finish the welcome.
  useEffect(() => {
    if (!connected || params.from !== 'link' || !accountState.ready || !accountState.user) return;
    if (appliedUser.current === accountState.user.id) return;
    appliedUser.current = accountState.user.id;
    applyAccount(accountState.user, 'google');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, params.from, accountState.ready, accountState.user]);

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

  const connectGoogle = async () => {
    if (advancing || busyProvider) return;
    setProviderError('');
    setBusyProvider('google');
    const outcome = await account.google();
    if (!outcome.ok) {
      setBusyProvider(null);
      setProviderError(outcome.message);
      return;
    }
    // On the web the page has gone to Google and comes back through the callback screen.
    if (outcome.status === 'signed-in') applyAccount(outcome.user, 'google');
  };

  const connectProvider = (next: Exclude<AuthProvider, 'email'>) => {
    if (advancing || busyProvider) return;
    if (connected) {
      if (next === 'google') void connectGoogle();
      return;
    }
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

  const submitEmail = async () => {
    if (busy) return;
    const nextEmail = email.trim();
    const mailOk = isEmail(nextEmail);
    const passMessage = connected
      ? intent === 'signin'
        ? password ? '' : 'Enter your password.'
        : passwordProblem(password)
      : password.trim().length >= 8 ? '' : 'Use at least 8 characters.';
    setEmailError(mailOk ? '' : 'Enter a valid email address.');
    setPasswordError(passMessage);
    setFormError('');
    setNotice('');
    if (!mailOk || passMessage) return;

    if (connected && intent === 'signin') {
      setBusy(true);
      const outcome = await account.signIn({ email: nextEmail, password });
      setBusy(false);
      if (!outcome.ok) return setFormError(outcome.message);
      if (outcome.status === 'signed-in') applyAccount(outcome.user, 'email');
      return;
    }
    setProvider('email');
    setPhotoOn(false);
    setStep('identity');
  };

  const forgotPassword = async () => {
    if (busy) return;
    if (!isEmail(email)) {
      setEmailError('Enter your email first, then tap this again.');
      return;
    }
    setBusy(true);
    setFormError('');
    const outcome = await account.forgotPassword(email);
    setBusy(false);
    if (!outcome.ok) return setFormError(outcome.message);
    setNotice('If there’s an account for that email, we’ve sent a link to choose a new password.');
  };

  const resendEmail = async () => {
    if (busy) return;
    setBusy(true);
    setFormError('');
    const outcome = await account.resendConfirmation(email);
    setBusy(false);
    if (!outcome.ok) return setFormError(outcome.message);
    setNotice('Sent again. It can take a minute to arrive. Check your spam folder too.');
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
    if (providerError && (connected ? id === 'google' : (id === 'google' && providerError.startsWith('Google')) || (id === 'apple' && providerError.startsWith('Apple')))) {
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
        title={'Your club.\nYour community.'}
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
        {!connected && (process.env.EXPO_OS === 'ios' || Platform.OS === 'web') ? (
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
        footer={<Button label={connected && intent === 'signin' ? 'Sign in' : 'Continue'} onPress={submitEmail} loading={busy} />}
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
          placeholder={connected && intent === 'create' ? 'At least 8 characters, with a number' : intent === 'signin' ? 'Your password' : 'At least 8 characters'}
          secureTextEntry
          autoComplete={intent === 'signin' ? 'current-password' : 'new-password'}
          textContentType={intent === 'signin' ? 'password' : 'newPassword'}
          returnKeyType="done"
          onSubmitEditing={submitEmail}
          error={passwordError}
          onBlur={() => setPasswordError(intent === 'create' && password.length > 0 && password.length < 8 ? 'Use at least 8 characters.' : '')}
        />
        {formError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        ) : null}
        {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
        {connected && intent === 'signin' ? (
          <Pressable accessibilityRole="button" onPress={forgotPassword} style={styles.quiet}>
            <Text style={styles.inlineLink}>Forgot your password?</Text>
          </Pressable>
        ) : null}
      </FlowShell>
    );
  }

  if (step === 'confirm') {
    return (
      <FlowShell
        onBack={back}
        stepKey="confirm"
        roy={{ pose: 'smile', size: 120, decorative: true }}
        title="Check your email"
        subtitle={`We sent a link to ${email.trim()}. Open it on this device to finish signing up.`}
        footer={<Button label="Send it again" variant="secondary" onPress={resendEmail} loading={busy} />}
      >
        {formError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        ) : null}
        {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
        <Text style={styles.noticeText}>Nothing in your inbox? Look in spam, or check you typed the address correctly.</Text>
        <Pressable accessibilityRole="button" onPress={() => { setIntent('signin'); setFormError(''); setNotice(''); setStep('email'); }} style={styles.quiet}>
          <Text style={styles.inlineMuted}>
            Already confirmed? <Text style={styles.inlineStrong}>Sign in</Text>
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => { setIntent('create'); setFormError(''); setNotice(''); setStep('email'); }} style={styles.quiet}>
          <Text style={styles.inlineMuted}>Wrong address? <Text style={styles.inlineStrong}>Change it</Text></Text>
        </Pressable>
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
      lively
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
            roy={choice.roy}
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
  noticeText: { color: colors.charcoal, fontSize: 13, lineHeight: 19, marginBottom: 8, ...typography.body },
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
