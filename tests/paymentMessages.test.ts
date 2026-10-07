import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { checkoutMessage, returnWording } from '../src/lib/paymentMessages.ts';

describe('what a parent reads about a payment', () => {
  it('has plain words for each answer of the server, and a safe fallback', () => {
    for (const code of ['sign_in', 'not_found', 'not_approved', 'nothing_to_pay', 'not_configured', 'stripe_unavailable', 'bad_return']) {
      assert.ok(checkoutMessage(code).length > 20, code);
    }
    assert.match(checkoutMessage('stripe_unavailable'), /Nothing was charged/);
    assert.match(checkoutMessage(undefined), /Nothing was charged/);
    assert.equal(checkoutMessage('constructor'), checkoutMessage(undefined));
  });

  it('never says paid on the return page, whatever the address claims', () => {
    for (const payment of ['success', 'canceled', 'paid', undefined, '<script>']) {
      const { title, body } = returnWording(payment);
      assert.doesNotMatch(`${title} ${body}`.replace(/will then show as paid/, ''), /you(’|')ve paid|payment (is )?(complete|confirmed)|is paid/i);
    }
    assert.match(returnWording('success').title, /confirming/);
    assert.match(returnWording('canceled').title, /No payment was taken/);
  });
});
