import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { joinOffer, offerHeadline, quoteRegistration } from '../src/lib/pricing.ts';

// Sundays run Sep 13 through Nov 22, 2026 at 9:00 AM Eastern: eleven sessions.
const beforeSeason = '2026-09-12T20:00:00-04:00';
const sundaySessionOne = '2026-09-13T09:30:00-04:00';
const today = '2026-10-03T12:00:00-04:00'; // Oct 4 through Nov 22 remain: eight sessions
const sundayMorningBefore = '2026-10-04T08:00:00-04:00'; // that day's session still counts
const lateSeason = '2026-11-08T07:00:00-05:00'; // Nov 8, 15, 22 remain: three sessions
const afterSeason = '2026-11-22T11:00:00-05:00';

describe('join-now offer', () => {
  it('charges the full season before the first session starts', () => {
    const offer = joinOffer(beforeSeason);
    assert.equal(offer.midSeason, false);
    assert.equal(offer.percentOff, 0);
    assert.equal(offer.firstChildCents, 12000);
    assert.equal(offer.siblingCents, 6000);
    assert.equal(offerHeadline(offer), null);
  });

  it('is $10 a remaining Sunday once the season is underway', () => {
    const offer = joinOffer(today);
    assert.equal(offer.sessionsLeft, 8);
    assert.equal(offer.firstChildCents, 8000);
    assert.equal(offer.percentOff, 33);
    assert.equal(offerHeadline(offer)?.badge, '33% off');
    assert.match(offerHeadline(offer)?.line ?? '', /33% off if you join now · 8 Sundays left/);
  });

  it('counts a session that has not started yet on the same Sunday', () => {
    assert.equal(joinOffer(sundayMorningBefore).sessionsLeft, 8);
    assert.equal(joinOffer('2026-10-04T09:01:00-04:00').sessionsLeft, 7);
  });

  it('drops one session as soon as the first one begins', () => {
    const offer = joinOffer(sundaySessionOne);
    assert.equal(offer.sessionsLeft, 10);
    assert.equal(offer.firstChildCents, 10000);
    assert.equal(offer.percentOff, 17);
  });

  it('never goes below $60, so the offer tops out at 50% off', () => {
    const offer = joinOffer(lateSeason);
    assert.equal(offer.sessionsLeft, 3);
    assert.equal(offer.firstChildCents, 6000);
    assert.equal(offer.percentOff, 50);
  });

  it('reports the season as over after the last session starts', () => {
    const offer = joinOffer(afterSeason);
    assert.equal(offer.ended, true);
    assert.equal(offer.sessionsLeft, 0);
    assert.equal(offerHeadline(offer), null);
  });

  it('keeps Eastern daylight and standard time straight across Nov 1', () => {
    // 9:00 AM EST on Nov 1 is 14:00Z. One minute earlier it still counts, one minute later it does not.
    assert.equal(joinOffer('2026-11-01T13:59:00Z').sessionsLeft, 4);
    assert.equal(joinOffer('2026-11-01T14:01:00Z').sessionsLeft, 3);
  });
});

describe('registration quote', () => {
  it('matches the published full-season sibling pricing', () => {
    assert.equal(quoteRegistration(1, beforeSeason).totalCents, 12000);
    assert.equal(quoteRegistration(2, beforeSeason).totalCents, 18000);
    assert.equal(quoteRegistration(3, beforeSeason).totalCents, 24000);
    assert.equal(quoteRegistration(2, beforeSeason).siblingSavingsCents, 6000);
    assert.equal(quoteRegistration(2, beforeSeason).joinSavingsCents, 0);
  });

  it('applies the same percentage off to every child mid-season', () => {
    const quote = quoteRegistration(2, today);
    assert.equal(quote.lines[0].cents, 8000); // first child
    assert.equal(quote.lines[1].cents, 4000); // $60 sibling at the same 33% off, rounded to whole dollars
    assert.equal(quote.totalCents, 12000);
    assert.equal(quote.fullRateCents, 24000);
    assert.equal(quote.savingsCents, 12000);
    assert.equal(quote.savingsCents, quote.siblingSavingsCents + quote.joinSavingsCents);
  });

  it('quotes nothing for no children', () => {
    const quote = quoteRegistration(0, today);
    assert.equal(quote.totalCents, 0);
    assert.deepEqual(quote.lines, []);
    assert.equal(quote.savingsCents, 0);
  });

  it('only produces whole-dollar amounts', () => {
    for (const now of [beforeSeason, sundaySessionOne, today, lateSeason]) {
      for (const count of [1, 2, 3, 4]) {
        for (const line of quoteRegistration(count, now).lines) assert.equal(line.cents % 100, 0);
      }
    }
  });
});
