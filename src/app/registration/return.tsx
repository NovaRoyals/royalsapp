import { router, useLocalSearchParams } from 'expo-router';

import { FlowShell } from '@/components/onboarding/FlowShell';
import { Button } from '@/components/ui';
import { returnWording } from '@/lib/paymentMessages';

/**
 * Where Stripe's hosted page sends a family back to. It never says "paid": the address can be
 * typed by anyone, so only the club's records (updated by a verified Stripe event) say that.
 */
export default function PaymentReturnScreen() {
  const { payment } = useLocalSearchParams<{ payment?: string }>();
  const words = returnWording(payment);
  return (
    <FlowShell
      stepKey="payment-return"
      roy={{ pose: payment === 'success' ? 'thumbsup' : 'smile', size: 120, decorative: true }}
      title={words.title}
      subtitle={words.body}
      footer={<Button label="Back to Home" onPress={() => router.replace('/(tabs)' as never)} />}
    />
  );
}
