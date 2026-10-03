import type { PaymentStatus, Registration, RegistrationStatus } from '../types/domain';

/**
 * How a registration moves, in one place.
 *
 * The club approves first, then asks for payment, so nothing is charged at submission.
 * Registration status says whether the club said yes. Payment status says where the money
 * is. They move separately: a family can be approved and unpaid, or waived and approved.
 *
 * Payment only ever becomes `paid` from a verified server event. The client can ask for a
 * checkout; it can never mark one complete.
 */

const LEGACY_PAYMENT: Record<string, PaymentStatus> = {
  // Older saved state used these two before the status model was split out.
  unpaid: 'not_requested',
  pending: 'not_requested',
};

export function normalizePayment(value: string | undefined): PaymentStatus {
  if (!value) return 'not_requested';
  return LEGACY_PAYMENT[value] ?? (value as PaymentStatus);
}

/** `pending` and `submitted` meant the same thing; saved state may hold either. */
export function normalizeRegistration(registration: Registration): Registration {
  const status: RegistrationStatus = registration.status === 'pending' ? 'submitted' : registration.status;
  return { ...registration, status, paymentStatus: normalizePayment(registration.paymentStatus) };
}

/** Plain-language status for lists. */
export function statusWord(status: RegistrationStatus) {
  if (status === 'approved') return 'Approved';
  if (status === 'waitlisted') return 'Waitlisted';
  if (status === 'rejected') return 'Not approved';
  if (status === 'cancelled') return 'Cancelled';
  return 'In review';
}

export const needsPayment = (registration: Pick<Registration, 'amountDue'>) => registration.amountDue > 0;

export const isInReview = (status: RegistrationStatus) => status === 'draft' || status === 'submitted' || status === 'pending';

export type Decision = 'approve' | 'waitlist' | 'reject' | 'cancel';

const SETTLED: PaymentStatus[] = ['paid', 'partially_refunded', 'refunded', 'waived', 'processing'];

/**
 * What a club decision does to a registration. Approving starts the payment request;
 * every other decision withdraws any request that has not been paid.
 */
export function applyDecision(registration: Registration, decision: Decision): Registration {
  const payment = normalizePayment(registration.paymentStatus);
  const settled = SETTLED.includes(payment);
  if (decision === 'approve') {
    const paymentStatus: PaymentStatus =
      !needsPayment(registration) || settled ? payment : 'awaiting_payment';
    return { ...registration, status: 'approved', paymentStatus };
  }
  const status: RegistrationStatus = decision === 'waitlist' ? 'waitlisted' : decision === 'reject' ? 'rejected' : 'cancelled';
  const paymentStatus: PaymentStatus = settled ? payment : decision === 'waitlist' ? 'not_requested' : 'canceled';
  return { ...registration, status, paymentStatus };
}

/** A fee waiver clears what is owed. It cannot undo a payment that was already taken. */
export function canWaive(registration: Registration) {
  const payment = normalizePayment(registration.paymentStatus);
  return needsPayment(registration) && (payment === 'not_requested' || payment === 'awaiting_payment' || payment === 'failed');
}

export function waiveFee(registration: Registration): Registration {
  return canWaive(registration) ? { ...registration, paymentStatus: 'waived' } : registration;
}

export function money(dollars: number) {
  return `$${dollars.toLocaleString('en-US')}`;
}

/** Short payment line for lists and the profile. Never prints a raw status word. */
export function paymentLine(registration: Registration) {
  const payment = normalizePayment(registration.paymentStatus);
  if (!needsPayment(registration)) return 'No fee';
  switch (payment) {
    case 'paid':
      return registration.status === 'rejected' || registration.status === 'cancelled'
        ? `Paid · ${money(registration.amountDue)} · refund needed`
        : `Paid · ${money(registration.amountDue)}`;
    case 'waived':
      return 'Fee waived';
    case 'awaiting_payment':
      return `Payment due · ${money(registration.amountDue)}`;
    case 'processing':
      return 'Payment processing';
    case 'failed':
      return `Payment failed · ${money(registration.amountDue)} due`;
    case 'partially_refunded':
      return 'Partly refunded';
    case 'refunded':
      return 'Refunded';
    case 'canceled':
      return 'No payment needed';
    default:
      return `${money(registration.amountDue)} · after club review`;
  }
}

export type StepState = 'done' | 'current' | 'upcoming' | 'stopped';
export type LadderStep = { id: 'submitted' | 'review' | 'payment' | 'confirmed'; label: string; detail: string; state: StepState };

export type Ladder = {
  headline: string;
  detail: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  steps: LadderStep[];
  /** True when the family has something to do now. */
  actionable: boolean;
};

export function registrationLadder(input: Registration): Ladder {
  const registration = normalizeRegistration(input);
  const payment = registration.paymentStatus;
  const fee = needsPayment(registration);
  const status = registration.status;
  const ended = status === 'rejected' || status === 'cancelled';
  const waitlisted = status === 'waitlisted';
  const approved = status === 'approved';
  const paidUp = !fee || payment === 'paid' || payment === 'waived' || payment === 'partially_refunded';

  const submitted: LadderStep = { id: 'submitted', label: 'Submitted', detail: 'We have your registration.', state: 'done' };

  const review: LadderStep = {
    id: 'review',
    label: 'Club review',
    detail: approved ? 'Approved' : waitlisted ? 'On the waitlist' : status === 'rejected' ? 'Not approved' : status === 'cancelled' ? 'Cancelled' : 'The club is reviewing it',
    state: approved ? 'done' : ended ? 'stopped' : 'current',
  };

  let payState: StepState = 'upcoming';
  let payDetail = fee ? 'Opens after approval' : 'No fee for this program';
  if (!fee) payState = approved ? 'done' : 'upcoming';
  else if (ended || waitlisted) {
    payState = 'upcoming';
    payDetail = ended ? 'Nothing to pay' : 'Only if a spot opens';
  } else if (approved) {
    if (payment === 'paid' || payment === 'partially_refunded') {
      payState = 'done';
      payDetail = `Paid ${money(registration.amountDue)}`;
    } else if (payment === 'waived') {
      payState = 'done';
      payDetail = 'Fee waived by the club';
    } else if (payment === 'processing') {
      payState = 'current';
      payDetail = 'Confirming your payment';
    } else if (payment === 'failed') {
      payState = 'current';
      payDetail = `Payment failed. ${money(registration.amountDue)} is still due`;
    } else {
      payState = 'current';
      payDetail = `${money(registration.amountDue)} due`;
    }
  }
  const pay: LadderStep = { id: 'payment', label: 'Payment', detail: payDetail, state: payState };

  const confirmedNow = approved && paidUp;
  const confirmed: LadderStep = {
    id: 'confirmed',
    label: 'Confirmed',
    detail: confirmedNow ? 'Your spot is confirmed' : 'Once approved and paid',
    state: confirmedNow ? 'done' : 'upcoming',
  };

  const steps = [submitted, review, pay, confirmed];

  if (ended) {
    const owed = payment === 'paid' && fee;
    return {
      headline: status === 'cancelled' ? 'Registration cancelled' : 'Not approved this time',
      detail: owed
        ? `The club will refund your ${money(registration.amountDue)} payment and be in touch.`
        : status === 'cancelled'
          ? 'Nothing more to do.'
          : 'The club could not place this registration. They will be in touch.',
      tone: 'danger',
      steps,
      actionable: false,
    };
  }
  if (waitlisted) {
    return { headline: 'You’re on the waitlist', detail: 'We’ll tell you the moment a spot opens. Nothing to pay yet.', tone: 'warning', steps, actionable: false };
  }
  if (!approved) {
    return { headline: 'Waiting for club review', detail: 'Nothing has been charged. We’ll tell you when it’s approved.', tone: 'warning', steps, actionable: false };
  }
  if (confirmedNow) {
    return { headline: 'You’re in', detail: 'Your spot is confirmed. See you on the field.', tone: 'success', steps, actionable: false };
  }
  if (payment === 'processing') {
    return { headline: 'Confirming your payment', detail: 'This can take a moment. You’ll see it here as soon as it clears.', tone: 'neutral', steps, actionable: false };
  }
  return {
    headline: payment === 'failed' ? 'Payment didn’t go through' : 'You’re approved. Payment is next',
    detail: payment === 'failed' ? 'Nothing was kept. You can try again.' : 'Pay to lock in your spot. The club will remind you.',
    tone: 'warning',
    steps,
    actionable: true,
  };
}
