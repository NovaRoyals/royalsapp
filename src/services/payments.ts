/**
 * Payment seam. The app only ever asks the server to start a checkout for a registration.
 * It never sends an amount, a discount or a status: the server recalculates the price from
 * the club's pricing records and decides what `paid` means from a verified Stripe event.
 *
 * Today only the demo gateway exists, so asking to pay is answered honestly with
 * "unavailable". A Stripe gateway (hosted Checkout in Expo Go and on the web, PaymentSheet
 * in a development build) slots in behind the same interface without touching the screens.
 */
export type CheckoutRequest = {
  registrationId: string;
};

export type CheckoutResult =
  | { kind: 'unavailable'; message: string }
  /** Hosted checkout page. Works in Expo Go and on web; return arrives by deep link or redirect. */
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

export const paymentGateway: PaymentGateway = new DemoPaymentGateway();
