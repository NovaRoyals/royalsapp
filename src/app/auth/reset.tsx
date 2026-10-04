import { router } from 'expo-router';
import { useState } from 'react';

import { FlowShell } from '@/components/onboarding/FlowShell';
import { FlowField } from '@/components/onboarding/Pieces';
import { Button } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { passwordProblem } from '@/lib/authMessages';
import { account } from '@/services/account';
import { useAccount } from '@/state/AccountProvider';

/** Reached from the password-reset email, once the link has signed the person in. */
export default function ResetPasswordScreen() {
  const toast = useToast();
  const { user, ready } = useAccount();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== again) return setError('The two passwords don’t match.');
    setError('');
    setBusy(true);
    const outcome = await account.setNewPassword(password);
    setBusy(false);
    if (!outcome.ok) return setError(outcome.message);
    toast('Password changed. You’re signed in.');
    router.replace('/(tabs)' as never);
  };

  if (ready && !user) {
    return (
      <FlowShell
        stepKey="reset-expired"
        title="That link has expired"
        subtitle="Ask for a new password link from the sign-in screen."
        footer={<Button label="Back to sign in" onPress={() => router.replace('/onboarding?mode=signin' as never)} />}
      />
    );
  }

  return (
    <FlowShell
      stepKey="reset"
      roy={{ pose: 'wink', size: 120, decorative: true }}
      title="Choose a new password"
      subtitle={user?.email ? `For ${user.email}` : undefined}
      footer={<Button label="Save password" onPress={submit} loading={busy} />}
    >
      <FlowField
        label="New password"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 8 characters, with a number"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
      />
      <FlowField
        label="Type it again"
        value={again}
        onChangeText={setAgain}
        placeholder="Same password"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={submit}
        error={error}
      />
    </FlowShell>
  );
}
