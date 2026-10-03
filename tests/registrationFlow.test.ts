import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyDecision,
  canWaive,
  normalizeRegistration,
  paymentLine,
  registrationLadder,
  waiveFee,
} from '../src/lib/registrationFlow.ts';
import type { Registration } from '../src/types/domain.ts';

function reg(patch: Partial<Registration> = {}): Registration {
  return {
    id: 'reg-1',
    programId: 'fall-kids-2026',
    participantIds: ['child-1'],
    participantNames: ['Maya Lee'],
    submittedAt: '2026-10-03T12:00:00-04:00',
    status: 'submitted',
    amountDue: 80,
    discountAmount: 40,
    paymentStatus: 'not_requested',
    demo: true,
    ...patch,
  };
}

describe('saved registrations from before the status split', () => {
  it('reads old unpaid and pending payment values as not requested', () => {
    const legacy = reg({ status: 'pending', paymentStatus: 'pending' as never });
    const fixed = normalizeRegistration(legacy);
    assert.equal(fixed.status, 'submitted');
    assert.equal(fixed.paymentStatus, 'not_requested');
    assert.equal(normalizeRegistration(reg({ paymentStatus: 'unpaid' as never })).paymentStatus, 'not_requested');
  });

  it('leaves current values alone', () => {
    const paid = reg({ status: 'approved', paymentStatus: 'paid' });
    assert.deepEqual(normalizeRegistration(paid), paid);
  });
});

describe('club decisions', () => {
  it('approving requests payment and nothing else', () => {
    const next = applyDecision(reg(), 'approve');
    assert.equal(next.status, 'approved');
    assert.equal(next.paymentStatus, 'awaiting_payment');
  });

  it('approving a free registration never asks for payment', () => {
    const next = applyDecision(reg({ amountDue: 0 }), 'approve');
    assert.equal(next.paymentStatus, 'not_requested');
  });

  it('approving twice does not reset a payment that is already settled', () => {
    for (const settled of ['paid', 'waived', 'processing'] as const) {
      const next = applyDecision(reg({ status: 'approved', paymentStatus: settled }), 'approve');
      assert.equal(next.paymentStatus, settled);
    }
  });

  it('waitlisting or rejecting withdraws an unpaid request', () => {
    const asked = reg({ status: 'approved', paymentStatus: 'awaiting_payment' });
    assert.equal(applyDecision(asked, 'waitlist').paymentStatus, 'not_requested');
    assert.equal(applyDecision(asked, 'reject').paymentStatus, 'canceled');
    assert.equal(applyDecision(asked, 'cancel').status, 'cancelled');
  });

  it('never erases a payment that was already taken', () => {
    const paid = reg({ status: 'approved', paymentStatus: 'paid' });
    assert.equal(applyDecision(paid, 'reject').paymentStatus, 'paid');
  });
});

describe('fee waivers', () => {
  it('waive what is owed but not what was paid', () => {
    assert.equal(canWaive(reg({ status: 'approved', paymentStatus: 'awaiting_payment' })), true);
    assert.equal(waiveFee(reg({ status: 'approved', paymentStatus: 'awaiting_payment' })).paymentStatus, 'waived');
    assert.equal(canWaive(reg({ status: 'approved', paymentStatus: 'paid' })), false);
    assert.equal(waiveFee(reg({ status: 'approved', paymentStatus: 'paid' })).paymentStatus, 'paid');
    assert.equal(canWaive(reg({ amountDue: 0 })), false);
  });
});

describe('what a family sees', () => {
  it('says nothing has been charged while the club reviews', () => {
    const ladder = registrationLadder(reg());
    assert.equal(ladder.headline, 'Waiting for club review');
    assert.match(ladder.detail, /Nothing has been charged/);
    assert.deepEqual(ladder.steps.map((step) => step.state), ['done', 'current', 'upcoming', 'upcoming']);
    assert.equal(ladder.actionable, false);
  });

  it('turns to payment after approval', () => {
    const ladder = registrationLadder(applyDecision(reg(), 'approve'));
    assert.equal(ladder.headline, 'You’re approved. Payment is next');
    assert.deepEqual(ladder.steps.map((step) => step.state), ['done', 'done', 'current', 'upcoming']);
    assert.equal(ladder.steps[2].detail, '$80 due');
    assert.equal(ladder.actionable, true);
  });

  it('confirms once paid or waived', () => {
    for (const paymentStatus of ['paid', 'waived'] as const) {
      const ladder = registrationLadder(reg({ status: 'approved', paymentStatus }));
      assert.equal(ladder.headline, 'You’re in');
      assert.equal(ladder.steps[3].state, 'done');
    }
  });

  it('waits for the server before saying paid', () => {
    const ladder = registrationLadder(reg({ status: 'approved', paymentStatus: 'processing' }));
    assert.equal(ladder.headline, 'Confirming your payment');
    assert.equal(ladder.steps[3].state, 'upcoming');
  });

  it('lets a family retry a failed payment', () => {
    const ladder = registrationLadder(reg({ status: 'approved', paymentStatus: 'failed' }));
    assert.equal(ladder.headline, 'Payment didn’t go through');
    assert.equal(ladder.actionable, true);
  });

  it('handles waitlisted, rejected and free registrations', () => {
    assert.equal(registrationLadder(reg({ status: 'waitlisted' })).headline, 'You’re on the waitlist');
    assert.equal(registrationLadder(reg({ status: 'rejected', paymentStatus: 'canceled' })).headline, 'Not approved this time');
    const free = registrationLadder(reg({ amountDue: 0, status: 'approved' }));
    assert.equal(free.headline, 'You’re in');
    assert.equal(free.steps[2].detail, 'No fee for this program');
  });

  it('never prints a raw status word in the payment line', () => {
    assert.equal(paymentLine(reg()), '$80 · after club review');
    assert.equal(paymentLine(reg({ status: 'approved', paymentStatus: 'awaiting_payment' })), 'Payment due · $80');
    assert.equal(paymentLine(reg({ status: 'approved', paymentStatus: 'paid' })), 'Paid · $80');
    assert.equal(paymentLine(reg({ amountDue: 0 })), 'No fee');
  });

  it('flags a refund when a paid registration is declined', () => {
    const declined = reg({ status: 'rejected', paymentStatus: 'paid' });
    assert.equal(paymentLine(declined), 'Paid · $80 · refund needed');
    assert.match(registrationLadder(declined).detail, /refund your \$80 payment/);
  });
});
