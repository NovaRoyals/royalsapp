import type { PaymentStatus } from '@/types/domain';

export type CheckoutRequest = {
  registrationId: string;
  amountCents: number;
  currency: 'USD';
};

export type CheckoutResult = {
  status: PaymentStatus;
  provider: string;
  providerReference?: string;
  isDemo: boolean;
};

export interface PaymentGateway {
  beginCheckout(request: CheckoutRequest): Promise<CheckoutResult>;
}

class DemoPaymentGateway implements PaymentGateway {
  async beginCheckout(_request: CheckoutRequest): Promise<CheckoutResult> {
    return {
      status: 'pending',
      provider: 'demo',
      isDemo: true,
    };
  }
}

export const paymentGateway: PaymentGateway = new DemoPaymentGateway();

// A production gateway must call a trusted server/Edge Function. The server
// recalculates totals and creates provider checkout state; no secret belongs here.
