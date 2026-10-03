import { zonedDateTime } from './datetime';

/**
 * Fall Soccer Training 2026 pricing.
 *
 * Full season is a flat $120 for the first child and $60 for each sibling. A family that
 * joins after the first session pays $10 for each Sunday still to come, never less than
 * the floor, and the app sells that as a percentage off rather than a smaller number.
 *
 * All math is in cents so the same rule can move into the server-side registration
 * function unchanged. The client's quote is for display; the server must recompute it.
 */
export const SEASON_PRICING = {
  fullCents: 12000,
  siblingCents: 6000,
  perSessionCents: 1000,
  /** First-child price never drops below this, which caps the offer at 50% off. */
  floorCents: 6000,
  firstSunday: '2026-09-13',
  lastSunday: '2026-11-22',
  /** Wall-clock start of every session. */
  startHour: 9,
} as const;

type Pricing = typeof SEASON_PRICING;

export type JoinOffer = {
  /** Sundays whose session has not started yet. */
  sessionsLeft: number;
  /** Sundays in the whole season. */
  sessionsTotal: number;
  /** True once the first session has started and the offer applies. */
  midSeason: boolean;
  /** Season is over; nothing is left to join. */
  ended: boolean;
  /** First-child price for this family, in cents. */
  firstChildCents: number;
  /** Price for each additional sibling, in cents. */
  siblingCents: number;
  /** Whole-number percentage off the full price. 0 before the season starts. */
  percentOff: number;
};

export type QuoteLine = { label: string; cents: number; listCents: number };

export type Quote = {
  childCount: number;
  lines: QuoteLine[];
  /** What the family pays. */
  totalCents: number;
  /** What the same children would cost at full-season rates with no sibling or join offer. */
  fullRateCents: number;
  /** Sibling savings plus join-offer savings. */
  savingsCents: number;
  siblingSavingsCents: number;
  joinSavingsCents: number;
  offer: JoinOffer;
};

function sundays(pricing: Pricing) {
  const [y1, m1, d1] = pricing.firstSunday.split('-').map(Number);
  const [y2, m2, d2] = pricing.lastSunday.split('-').map(Number);
  const out: Date[] = [];
  const cursor = new Date(Date.UTC(y1, m1 - 1, d1));
  const last = Date.UTC(y2, m2 - 1, d2);
  while (cursor.getTime() <= last) {
    out.push(zonedDateTime(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate(), pricing.startHour, 0));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return out;
}

const wholeDollars = (cents: number) => Math.round(cents / 100) * 100;

export function joinOffer(nowIso: string, pricing: Pricing = SEASON_PRICING): JoinOffer {
  const starts = sundays(pricing);
  const now = new Date(nowIso).getTime();
  const sessionsLeft = starts.filter((start) => start.getTime() > now).length;
  const midSeason = now >= starts[0].getTime();
  if (!midSeason) {
    return {
      sessionsLeft,
      sessionsTotal: starts.length,
      midSeason,
      ended: false,
      firstChildCents: pricing.fullCents,
      siblingCents: pricing.siblingCents,
      percentOff: 0,
    };
  }
  const prorated = Math.min(pricing.fullCents, Math.max(pricing.floorCents, sessionsLeft * pricing.perSessionCents));
  const share = prorated / pricing.fullCents;
  return {
    sessionsLeft,
    sessionsTotal: starts.length,
    midSeason,
    ended: sessionsLeft === 0,
    firstChildCents: prorated,
    siblingCents: wholeDollars(pricing.siblingCents * share),
    percentOff: Math.round((1 - share) * 100),
  };
}

export function quoteRegistration(childCount: number, nowIso: string, pricing: Pricing = SEASON_PRICING): Quote {
  const offer = joinOffer(nowIso, pricing);
  const count = Math.max(0, Math.floor(childCount));
  const lines: QuoteLine[] = [];
  if (count > 0) lines.push({ label: 'First child', cents: offer.firstChildCents, listCents: pricing.fullCents });
  if (count > 1) {
    const siblings = count - 1;
    lines.push({
      label: `${siblings} ${siblings === 1 ? 'sibling' : 'siblings'}`,
      cents: offer.siblingCents * siblings,
      listCents: pricing.siblingCents * siblings,
    });
  }
  const totalCents = lines.reduce((sum, line) => sum + line.cents, 0);
  const fullRateCents = count * pricing.fullCents;
  const siblingSavingsCents = Math.max(0, count - 1) * (pricing.fullCents - pricing.siblingCents);
  const listTotal = lines.reduce((sum, line) => sum + line.listCents, 0);
  return {
    childCount: count,
    lines,
    totalCents,
    fullRateCents,
    savingsCents: fullRateCents - totalCents,
    siblingSavingsCents,
    joinSavingsCents: listTotal - totalCents,
    offer,
  };
}

/** Price for the child at this position in the registration, in whole dollars. */
export function childPriceDollars(position: number, nowIso: string) {
  const offer = joinOffer(nowIso);
  return (position === 0 ? offer.firstChildCents : offer.siblingCents) / 100;
}

export const dollars = (cents: number) => `$${(cents / 100).toLocaleString('en-US')}`;

/** Short, honest promo copy. Returns null when there is no offer to show. */
export function offerHeadline(offer: JoinOffer) {
  if (!offer.midSeason || offer.ended || offer.percentOff <= 0) return null;
  const left = `${offer.sessionsLeft} ${offer.sessionsLeft === 1 ? 'Sunday' : 'Sundays'} left`;
  return { badge: `${offer.percentOff}% off`, line: `${offer.percentOff}% off if you join now · ${left}` };
}
