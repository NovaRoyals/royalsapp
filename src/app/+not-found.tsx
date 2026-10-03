import { router } from 'expo-router';

import { Button, EmptyState, Screen } from '@/components/ui';

export default function NotFoundScreen() {
  return (
    <Screen>
      <EmptyState
        pose="confused"
        title="We can’t find that page"
        message="The link may be old, or the page may have moved."
        action={<Button label="Back to Home" onPress={() => router.replace('/')} />}
      />
    </Screen>
  );
}
