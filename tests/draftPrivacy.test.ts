import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { redactDraftForm } from '../src/lib/draftPrivacy.ts';

describe('registration draft privacy', () => {
  const form = {
    guardianName: 'Test Parent',
    email: 'parent@example.test',
    phone: '5555550100',
    address: '1 Test Street',
    parentConsent: true,
    emergencyConsent: true,
    signature: 'Test Parent',
  };

  it('never keeps consent or the typed signature', () => {
    const saved = redactDraftForm(form);
    assert.equal(saved.parentConsent, false);
    assert.equal(saved.emergencyConsent, false);
    assert.equal(saved.signature, '');
  });

  it('keeps the contact details that make returning easy', () => {
    const saved = redactDraftForm(form);
    assert.equal(saved.guardianName, form.guardianName);
    assert.equal(saved.email, form.email);
    assert.equal(saved.phone, form.phone);
    assert.equal(saved.address, form.address);
  });

  it('does not change the form it was given', () => {
    redactDraftForm(form);
    assert.equal(form.signature, 'Test Parent');
    assert.equal(form.parentConsent, true);
  });
});
