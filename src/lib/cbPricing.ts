/**
 * Claim Buddy subscription math.
 *
 * - 30 day free trial. Nothing is charged before day 31.
 * - Basic: $19.99 / user / month. No bundled seats.
 * - Pro: $120 / month, includes 3 seats, $30 / month per extra seat.
 * - Elite: $200 / month (company setup + market price book), includes 3 seats,
 *   $40 / month per extra seat.
 */

export type CbPlanId = "basic" | "pro" | "elite";

export type CbPlan = {
  id: CbPlanId;
  name: string;
  /** Flat monthly company fee (0 for purely per-seat plans). */
  base: number;
  /** Seats covered by the base fee. */
  includedSeats: number;
  /** Monthly price of every seat beyond the included ones. */
  seatRate: number;
  minSeats: number;
  blurb: string;
};

export const CB_PLANS: Record<CbPlanId, CbPlan> = {
  basic: {
    id: "basic",
    name: "Basic",
    base: 0,
    includedSeats: 0,
    seatRate: 19.99,
    minSeats: 1,
    blurb: "Inspection workflow, polygon measurements and manual line-item estimates.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    base: 120,
    includedSeats: 3,
    seatRate: 30,
    minSeats: 3,
    blurb: "Everything in Basic plus AI instant measurements and the Survival Guide.",
  },
  elite: {
    id: "elite",
    name: "Elite",
    base: 200,
    includedSeats: 3,
    seatRate: 40,
    minSeats: 3,
    blurb: "Everything in Pro plus Storm Intel and your market Xactimate price book.",
  },
};

export const CB_PLAN_ORDER: CbPlanId[] = ["basic", "pro", "elite"];
export const CB_MAX_SEATS = 50;
export const CB_TRIAL_DAYS = 30;
export const CB_DEFAULT_PLAN: CbPlanId = "pro";

/** Kept for callers that only deal with the seat-bundled plans. */
export const CB_INCLUDED_SEATS = CB_PLANS.pro.includedSeats;

export function planOf(plan: CbPlanId | CbPlan): CbPlan {
  return typeof plan === "string" ? CB_PLANS[plan] ?? CB_PLANS[CB_DEFAULT_PLAN] : plan;
}

export function clampSeats(seats: number, plan: CbPlanId = CB_DEFAULT_PLAN): number {
  const p = planOf(plan);
  if (!Number.isFinite(seats)) return p.minSeats;
  return Math.min(CB_MAX_SEATS, Math.max(p.minSeats, Math.round(seats)));
}

/** Monthly cost of the seats not covered by the plan's base fee. */
export function extraSeatCost(seats: number, plan: CbPlanId = CB_DEFAULT_PLAN): number {
  const p = planOf(plan);
  const total = clampSeats(seats, p.id);
  return Math.max(0, total - p.includedSeats) * p.seatRate;
}

export type CbQuote = {
  plan: CbPlan;
  seats: number;
  extraSeats: number;
  extraSeatCost: number;
  /** Charged on day 31. */
  firstCharge: number;
  /** Every month after the first. */
  recurring: number;
  trialEndsAt: Date;
};

export function quoteSeats(
  seats: number,
  plan: CbPlanId = CB_DEFAULT_PLAN,
  from: Date = new Date(),
): CbQuote {
  const p = planOf(plan);
  const total = clampSeats(seats, p.id);
  const extras = extraSeatCost(total, p.id);
  const monthly = round2(p.base + extras);
  return {
    plan: p,
    seats: total,
    extraSeats: Math.max(0, total - p.includedSeats),
    extraSeatCost: round2(extras),
    firstCharge: monthly,
    recurring: monthly,
    trialEndsAt: new Date(from.getTime() + CB_TRIAL_DAYS * 24 * 60 * 60 * 1000),
  };
}

export function money(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  });
}

export function planPriceLabel(plan: CbPlanId): string {
  const p = planOf(plan);
  return p.base === 0
    ? `${money(p.seatRate)}/user/mo`
    : `${money(p.base)}/mo · ${p.includedSeats} seats`;
}

export function seatRateLabel(_seats: number, plan: CbPlanId = CB_DEFAULT_PLAN): string {
  const p = planOf(plan);
  return p.base === 0
    ? `${money(p.seatRate)}/mo per user`
    : `${p.includedSeats} seats included · ${money(p.seatRate)}/mo per additional seat`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const CB_PENDING_SEATS_KEY = "cb.pendingSeats";
export const CB_PENDING_PLAN_KEY = "cb.pendingPlan";
