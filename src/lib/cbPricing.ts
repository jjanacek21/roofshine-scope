/**
 * Claim Buddy subscription math.
 *
 * - 30 day free trial. Nothing is charged before day 31.
 * - Day 31: $199 setup + first month (includes 3 seats and a custom price book
 *   built for the company's market).
 * - Every month after: $99 base for the same 3 seats.
 * - Additional seats beyond the included 3:
 *     seats 4-25   -> $29.99 / seat / month
 *     seats 26-50  -> $19.99 / seat / month
 */

export const CB_INCLUDED_SEATS = 3;
export const CB_MAX_SEATS = 50;
export const CB_FIRST_MONTH = 199;
export const CB_MONTHLY_BASE = 99;
export const CB_TIER1_LIMIT = 25; // seats 4..25
export const CB_TIER1_RATE = 29.99;
export const CB_TIER2_RATE = 19.99;
export const CB_TRIAL_DAYS = 30;

export function clampSeats(seats: number): number {
  if (!Number.isFinite(seats)) return CB_INCLUDED_SEATS;
  return Math.min(CB_MAX_SEATS, Math.max(CB_INCLUDED_SEATS, Math.round(seats)));
}

/** Monthly cost of the seats above the 3 that are included. */
export function extraSeatCost(seats: number): number {
  const total = clampSeats(seats);
  const tier1 = Math.max(0, Math.min(total, CB_TIER1_LIMIT) - CB_INCLUDED_SEATS);
  const tier2 = Math.max(0, total - CB_TIER1_LIMIT);
  return tier1 * CB_TIER1_RATE + tier2 * CB_TIER2_RATE;
}

export type CbQuote = {
  seats: number;
  extraSeats: number;
  extraSeatCost: number;
  /** Charged on day 31 — setup + first month + extra seats. */
  firstCharge: number;
  /** Every month after the first. */
  recurring: number;
  trialEndsAt: Date;
};

export function quoteSeats(seats: number, from: Date = new Date()): CbQuote {
  const total = clampSeats(seats);
  const extras = extraSeatCost(total);
  const trialEndsAt = new Date(from.getTime() + CB_TRIAL_DAYS * 24 * 60 * 60 * 1000);
  return {
    seats: total,
    extraSeats: total - CB_INCLUDED_SEATS,
    extraSeatCost: round2(extras),
    firstCharge: round2(CB_FIRST_MONTH + extras),
    recurring: round2(CB_MONTHLY_BASE + extras),
    trialEndsAt,
  };
}

export function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function seatRateLabel(seats: number): string {
  return clampSeats(seats) > CB_TIER1_LIMIT
    ? `${money(CB_TIER1_RATE)}/mo for seats 4–25, ${money(CB_TIER2_RATE)}/mo for seats 26–50`
    : `${money(CB_TIER1_RATE)}/mo per additional seat`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const CB_PENDING_SEATS_KEY = "cb.pendingSeats";
