import { Platform } from 'react-native';

import { checkoutMessage } from '@/lib/paymentMessages';
import { supabase } from '@/lib/supabase';

/**
 * Payment seam. The app only ever asks the server to start a checkout for a registration.
 * It never sends an amount, a discount or a status: the database works out what is owed, and
 * `paid` is decided only from a signature-verified Stripe event (see supabase/functions).
 *
 * Without a Supabase project (demo mode) the demo gateway answers honestly that payment is
 * unavailable. With one, the Stripe gateway returns the address of Stripe's hosted payment page,
 * which works on the web today. Paying inside the phone app needs a development build
 * (PaymentSheet, Apple Pay) and is not built yet.
 */
export type CheckoutRequest = {
  registrationId: string;
};

export type CheckoutResult =
  | { kind: 'unavailable'; message: string }
  /** Hosted checkout page. Return arrives by redirect to the web app's /registration/return. */
  | { kind: 'redirect'; url: string };

export interface PaymentGateway {
  beginCheckout(request: CheckoutRequest): Promise<CheckoutResult>;
}

class DemoPaymentGateway implements PaymentGateway {
  async beginCheckout(_request: CheckoutRequest): Promise<CheckoutResult> {
    return {
      kind: 'unavailable',
      message: 'Online payment isn’t switched on yet. The club will message you as soon as it is.',
    };
  }
}

class StripePaymentGateway implements PaymentGateway {
  async beginCheckout({ registrationId }: CheckoutRequest): Promise<CheckoutResult> {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return { kind: 'unavailable', message: 'Paying inside the phone app is coming soon. For now, please pay from the club’s web app.' };
    }
    try {
      const { data, error } = await supabase!.functions.invoke('create-checkout', {
        body: { registrationId, returnTo: `${window.location.origin}/registration/return` },
      });
      if (error) {
        const body = await (error as { context?: Response }).context?.json().catch(() => null);
        return { kind: 'unavailable', message: checkoutMessage((body as { error?: string } | null)?.error) };
      }
      const url = (data as { url?: string } | null)?.url;
      return url ? { kind: 'redirect', url } : { kind: 'unavailable', message: checkoutMessage(undefined) };
    } catch {
      return { kind: 'unavailable', message: checkoutMessage(undefined) };
    }
  }
}

export const paymentGateway: PaymentGateway = supabase ? new StripePaymentGateway() : new DemoPaymentGateway();
