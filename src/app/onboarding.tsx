import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { Roy } from '@/components/mascot';
import { CrownMark } from '@/components/onboarding/Decor';
import { FlowShell } from '@/components/onboarding/FlowShell';
import { ChoiceCard, FlowField, OrRule, ProviderButton, TickRow, ToggleRow, type Tint } from '@/components/onboarding/Pieces';
import { Button } from '@/components/ui';
import { safeBack } from '@/lib/nav';
import { defaultNotificationPrefs, useApp } from '@/state/AppProvider';
import { colors, spacing, typography } from '@/theme/tokens';
import type { NotificationPrefs, Person, UserRole } from '@/types/domain';

type RoleChoice = 'parent' | 'player' | 'coach' | 'manager' | 'supporter';
type Step = 'welcome' | 'account' | 'signin' | 'name' | 'role' | 'players' | 'programs' | 'notifications' | 'done';

const ROLE_CHOICES: {
  id: RoleChoice;
  icon: keyof typeof Ionicons.glyphMap;
  tint: Tint;
  title: string;
  detail: string;
}[] = [
  { id: 'parent', icon: 'people', tint: 'green', title: 'Parent / guardian', detail: 'Register a player, view schedule' },
  { id: 'player', icon: 'football', tint: 'blue', title: 'Player', detail: 'View teams, schedule, track progress' },
  { id: 'coach', icon: 'clipboard', tint: 'teal', title: 'Coach', detail: 'Request staff access for your squad' },
  { id: 'manager', icon: 'briefcase', tint: 'amber', title: 'Team manager', detail: 'Request club operations access' },
  { id: 'supporter', icon: 'heart', tint: 'rose', title: 'Fan / supporter', detail: 'Follow teams and get updates' },
];

const PROGRAM_CHOICES: { id: string; icon: keyof typeof Ionicons.glyphMap; tint: Tint; title: string; detail: string; ids: string[]; cricket?: boolean }[] = [
  { id: 'open', icon: 'football', tint: 'green', title: 'Open soccer', detail: 'Men’s Open 8v8 · Sunday evenings', ids: ['nova-royals-men'] },
  { id: 'veterans', icon: 'medal', tint: 'amber', title: '35+ soccer', detail: 'Thursday nights · FXA 8v8', ids: ['nova-royals-35plus', 'veterans-soccer'] },
  { id: 'women', icon: 'football', tint: 'rose', title: 'Women’s soccer', detail: 'Adult women’s team', ids: ['nova-royals-women'] },
  { id: 'kids', icon: 'happy', tint: 'blue', title: 'Kids soccer', detail: 'Ages 3–16 · Sunday training', ids: ['fall-kids-2026'] },
  { id: 'cricket', icon: 'baseball', tint: 'teal', title: 'Cricket', detail: 'CCPL T20 · Manassas1', ids: ['nova-royals-cricket'], cricket: true },
];

const ROLE_TO_USER: Record<RoleChoice, UserRole> = {
  parent: 'guardian',
  player: 'adult_player',
  coach: 'volunteer',
  manager: 'volunteer',
  supporter: 'volunteer',
};

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { completeOnboarding, loadDemoPersona, completeIntro, introCompleted } = useApp();

  const [step, setStep] = useState<Step>(params.mode === 'signin' ? 'signin' : 'welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [roleChoice, setRoleChoice] = useState<RoleChoice | null>(null);
  const [players, setPlayers] = useState<Person[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [sports, setSports] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultNotificationPrefs);

  const order: Step[] =
    roleChoice === 'parent'
      ? ['account', 'name', 'role', 'players', 'programs', 'notifications']
      : ['account', 'name', 'role', 'programs', 'notifications'];
  const index = order.indexOf(step);
  const progress = index >= 0 ? { step: index + 1, total: order.length } : undefined;

  const goTo = (next: Step) => setStep(next);
  const advance = () => {
    const next = order[index + 1];
    if (next) goTo(next);
  };
  const back = () => {
    if (step === 'signin') return goTo('welcome');
    const previous = order[index - 1];
    if (previous) return goTo(previous);
    if (introCompleted) return safeBack('/(tabs)');
    goTo('welcome');
  };

  const guest = () => {
    completeIntro();
    router.replace('/(tabs)');
  };

  const save = () => {
    const choice = roleChoice ?? 'supporter';
    completeOnboarding({
      role: ROLE_TO_USER[choice],
      children: choice === 'parent' ? players : [],
      followedIds: [...new Set(PROGRAM_CHOICES.filter((item) => sports.includes(item.id)).flatMap((item) => item.ids))],
      notificationPrefs: prefs,
      guardianName: `${firstName.trim()} ${lastName.trim()}`.trim(),
      email,
      pendingStaffRole: choice === 'coach' ? 'coach' : choice === 'manager' ? 'competition_manager' : null,
    });
    goTo('done');
  };

  const addPlayer = () => {
    const name = playerName.trim();
    if (!name) return;
    setPlayers((current) => [
      ...current,
      { id: `child-${Date.now()}`, firstName: name, lastName: lastName.trim(), displayName: name, isMinor: true },
    ]);
    setPlayerName('');
  };

  const firstNameOnly = firstName.trim().split(' ')[0];

  if (step === 'welcome') {
    return (
      <FlowShell
        tone="dark"
        fill
        onSkip={introCompleted ? () => safeBack('/(tabs)') : undefined}
        skipLabel="Close"
        above={
          <View style={styles.lockup}>
            <CrownMark size={22} color={colors.amber} />
            <Text style={styles.lockupName}>NOVA ROYALS</Text>
            <Text style={styles.lockupTag}>MORE THAN A GAME</Text>
          </View>
        }
        roy={{ pose: 'wave', size: 268 }}
        title={'Same lion.\nBigger tomorrows.'}
        subtitle="Soccer. Cricket. Community. For every player’s journey."
        footer={
          <>
            <Button label="Get started" variant="light" onPress={() => goTo('account')} />
            <View style={styles.welcomeLinks}>
              <Pressable accessibilityRole="button" onPress={() => goTo('signin')}>
                <Text style={styles.welcomeLink}>
                  Already have an account? <Text style={styles.welcomeLinkStrong}>Log in</Text>
                </Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={guest}>
                <Text style={styles.welcomeGuest}>Just looking around</Text>
              </Pressable>
            </View>
          </>
        }
      />
    );
  }

  if (step === 'signin') {
    return (
      <FlowShell
        onBack={back}
        title="Welcome back"
        subtitle="The demo signs you in to a seeded parent household. Coach tools stay on their own demo profiles."
        footer={
          <>
            <Button
              label="Log in"
              onPress={() => {
                loadDemoPersona('guardian');
                router.replace('/(tabs)');
              }}
            />
            <Pressable accessibilityRole="button" onPress={() => goTo('account')}>
              <Text style={styles.inlineLink}>New here? Create an account</Text>
            </Pressable>
          </>
        }
      >
        <FlowField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
        <FlowField label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry />
      </FlowShell>
    );
  }

  if (step === 'account') {
    return (
      <FlowShell
        onBack={back}
        step={progress?.step}
        total={progress?.total}
        title="Let’s get you in"
        subtitle="Create an account or continue with one you already use."
        footer={<Button label="Continue" disabled={!email.trim()} onPress={advance} />}
        footnote={<Text style={styles.legal}>By continuing you agree to the club’s terms and privacy policy.</Text>}
      >
        <ProviderButton icon="logo-google" label="Continue with Google" color="#DB4437" onPress={advance} />
        <ProviderButton icon="logo-apple" label="Continue with Apple" color={colors.ink} onPress={advance} />
        <OrRule label="or sign up with email" />
        <FlowField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          valid={email.includes('@') && email.includes('.')}
        />
        <FlowField label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry />
      </FlowShell>
    );
  }

  if (step === 'name') {
    return (
      <FlowShell
        onBack={back}
        step={progress?.step}
        total={progress?.total}
        title={firstNameOnly ? `Nice to meet you,\n${firstNameOnly}!` : 'Nice to meet you'}
        subtitle="This is how the club greets you."
        footer={<Button label="Continue" disabled={!firstName.trim()} onPress={advance} />}
      >
        <FlowField label="First name" value={firstName} onChangeText={setFirstName} placeholder="First name" autoCapitalize="words" valid={firstName.trim().length > 1} />
        <FlowField label="Last name" value={lastName} onChangeText={setLastName} placeholder="Last name" autoCapitalize="words" />
      </FlowShell>
    );
  }

  if (step === 'role') {
    return (
      <FlowShell
        onBack={back}
        step={progress?.step}
        total={progress?.total}
        title="What best describes you?"
        subtitle="We’ll personalize your Home from this. Coach and manager access is requested, not granted here."
      >
        {ROLE_CHOICES.map((choice) => (
          <ChoiceCard
            key={choice.id}
            icon={choice.icon}
            tint={choice.tint}
            title={choice.title}
            detail={choice.detail}
            selected={roleChoice === choice.id}
            onPress={() => {
              setRoleChoice(choice.id);
              goTo(choice.id === 'parent' ? 'players' : 'programs');
            }}
          />
        ))}
      </FlowShell>
    );
  }

  if (step === 'players') {
    return (
      <FlowShell
        onBack={back}
        step={progress?.step}
        total={progress?.total}
        title="Add your player(s)"
        subtitle="You can add more later."
        footer={
          <Button
            label={players.length ? 'Continue' : 'I’ll do this later'}
            variant={players.length ? 'primary' : 'secondary'}
            onPress={advance}
          />
        }
      >
        {players.map((player) => (
          <ChoiceCard key={player.id} icon="happy" tint="green" title={player.firstName} detail="Birth date stays private" trailing="none" />
        ))}
        <FlowField
          label="Player’s first name"
          value={playerName}
          onChangeText={setPlayerName}
          placeholder="First name"
          autoCapitalize="words"
          onSubmitEditing={addPlayer}
          returnKeyType="done"
        />
        <Pressable accessibilityRole="button" onPress={addPlayer} style={styles.addRow}>
          <View style={styles.addIcon}>
            <Ionicons name="add" size={16} color={colors.ink} />
          </View>
          <Text style={styles.addLabel}>Add a player</Text>
        </Pressable>
        <View style={styles.cheer}>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>You’re almost there!</Text>
          </View>
          <Roy pose="idea" still size={150} />
        </View>
      </FlowShell>
    );
  }

  if (step === 'programs') {
    const toggleSport = (id: string) => {
      setSports((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    };
    return (
      <FlowShell
        onBack={back}
        step={progress?.step}
        total={progress?.total}
        title="Which program(s) interest you?"
        subtitle="Pick one or two — 35+ players often also play Open."
        footer={<Button label="Continue" disabled={!sports.length} onPress={advance} />}
      >
        {PROGRAM_CHOICES.map((choice) => (
          <ChoiceCard
            key={choice.id}
            icon={choice.icon}
            tint={choice.tint}
            title={choice.title}
            detail={choice.detail}
            trailing="checkbox"
            cricket={choice.cricket}
            selected={sports.includes(choice.id)}
            onPress={() => toggleSport(choice.id)}
          />
        ))}
      </FlowShell>
    );
  }

  if (step === 'notifications') {
    return (
      <FlowShell
        onBack={back}
        step={progress?.step}
        total={progress?.total}
        title="Stay in the loop"
        subtitle="Only what matters. Change any of this later in Profile."
        footer={<Button label="Create my account" onPress={save} />}
      >
        <ToggleRow
          icon="football"
          tint="green"
          label="Game & practice reminders"
          value={prefs.team}
          onValueChange={(next) => setPrefs((current) => ({ ...current, team: next }))}
        />
        <ToggleRow
          icon="warning"
          tint="rose"
          label="Urgent alerts"
          detail="Field closures and cancellations"
          value={prefs.urgent}
          onValueChange={(next) => setPrefs((current) => ({ ...current, urgent: next }))}
        />
        <ToggleRow
          icon="megaphone"
          tint="amber"
          label="Club news"
          value={prefs.community}
          onValueChange={(next) => setPrefs((current) => ({ ...current, community: next }))}
        />
      </FlowShell>
    );
  }

  const staffRequest = roleChoice === 'coach' || roleChoice === 'manager';
  return (
    <FlowShell
      tone="dark"
      fill
      confetti
      roy={{ pose: 'celebrate', size: 260 }}
      title={'Welcome to\nthe team!'}
      subtitle={
        staffRequest
          ? 'You’re now part of Nova Royals. Staff tools stay locked until an admin approves your request.'
          : 'You’re now part of the Nova Royals community.'
      }
      footer={<Button label="Go to Home" variant="light" onPress={() => router.replace('/(tabs)')} />}
    >
      <View style={styles.ticks}>
        <TickRow label="Account created" />
        <TickRow label="Preferences saved" />
        <TickRow label={staffRequest ? 'Access requested' : 'Notifications on'} />
      </View>
    </FlowShell>
  );
}

const styles = StyleSheet.create({
  lockup: { alignItems: 'center', gap: 2, paddingTop: 4 },
  lockupName: { color: colors.white, fontSize: 13, ...typography.label, letterSpacing: 2.4 },
  lockupTag: { color: colors.mintDeep, fontSize: 9, ...typography.label, letterSpacing: 1.8 },
  welcomeLinks: { alignItems: 'center', gap: 0, marginTop: 4 },
  welcomeLink: { color: 'rgba(255,255,255,0.72)', fontSize: 13, paddingVertical: 8, ...typography.body },
  welcomeLinkStrong: { color: colors.white, ...typography.label },
  welcomeGuest: { color: colors.mintDeep, fontSize: 13, paddingVertical: 4, ...typography.label },
  inlineLink: { color: colors.ink, textAlign: 'center', paddingVertical: spacing.md, fontSize: 13, ...typography.label },
  legal: { color: colors.stone, textAlign: 'center', fontSize: 11, lineHeight: 16, marginTop: 8, ...typography.body },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  addIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: { color: colors.ink, fontSize: 14, ...typography.label },
  cheer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', marginTop: 8 },
  bubble: {
    backgroundColor: colors.mint,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 36,
    marginRight: -8,
  },
  bubbleText: { color: colors.ink, fontSize: 13, ...typography.heading },
  ticks: { marginTop: 12 },
});
