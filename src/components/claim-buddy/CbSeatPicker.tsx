import {
  CB_MAX_SEATS,
  CB_PLANS,
  CB_PLAN_ORDER,
  CB_TRIAL_DAYS,
  clampSeats,
  money,
  planOf,
  quoteSeats,
  seatRateLabel,
  type CbPlanId,
} from "@/lib/cbPricing";

type Props = {
  seats: number;
  onChange: (seats: number) => void;
  plan?: CbPlanId;
  onPlanChange?: (plan: CbPlanId) => void;
};

/** Plan + seat selector with a live price breakdown, used on signup and billing settings. */
export function CbSeatPicker({ seats, onChange, plan = "pro", onPlanChange }: Props) {
  const p = planOf(plan);
  const q = quoteSeats(seats, p.id);
  const set = (n: number) => onChange(clampSeats(n, p.id));

  return (
    <div className="space-y-5">
      {onPlanChange ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {CB_PLAN_ORDER.map((id) => {
            const opt = CB_PLANS[id];
            const active = id === p.id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onPlanChange(id);
                  onChange(clampSeats(seats, id));
                }}
                className="rounded-2xl p-3 text-left"
                style={{
                  border: `1px solid ${active ? "var(--cb-accent, #15803d)" : "var(--cb-border, #e2e8e5)"}`,
                  background: active ? "var(--cb-accent-soft, #f0fdf4)" : "var(--cb-surface, #fff)",
                }}
              >
                <div className="text-[15px] font-semibold">{opt.name}</div>
                <div className="text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                  {opt.base === 0
                    ? `${money(opt.seatRate)}/user/mo`
                    : `${money(opt.base)}/mo · ${opt.includedSeats} seats`}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        className="rounded-2xl p-4"
        style={{ background: "var(--cb-surface, #fff)", border: "1px solid var(--cb-border, #e2e8e5)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[15px] font-semibold">Team seats</div>
            <div className="text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
              {p.includedSeats > 0
                ? `${p.includedSeats} seats included · up to ${CB_MAX_SEATS}`
                : `Billed per user · up to ${CB_MAX_SEATS}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Remove a seat"
              onClick={() => set(q.seats - 1)}
              className="h-11 w-11 rounded-xl text-xl font-semibold"
              style={{ border: "1px solid var(--cb-border, #e2e8e5)" }}
            >
              −
            </button>
            <input
              aria-label="Number of seats"
              inputMode="numeric"
              value={q.seats}
              onChange={(e) => set(Number(e.target.value.replace(/\D/g, "")) || p.minSeats)}
              className="h-11 w-16 rounded-xl text-center text-lg font-bold"
              style={{ border: "1px solid var(--cb-border, #e2e8e5)" }}
            />
            <button
              type="button"
              aria-label="Add a seat"
              onClick={() => set(q.seats + 1)}
              className="h-11 w-11 rounded-xl text-xl font-semibold"
              style={{ border: "1px solid var(--cb-border, #e2e8e5)" }}
            >
              +
            </button>
          </div>
        </div>

        <input
          type="range"
          min={p.minSeats}
          max={CB_MAX_SEATS}
          value={q.seats}
          aria-label="Seats slider"
          onChange={(e) => set(Number(e.target.value))}
          className="mt-4 w-full"
        />
        <div className="mt-1 text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
          {seatRateLabel(q.seats, p.id)}
        </div>
      </div>

      <ul className="space-y-2 text-[14px]">
        {p.base > 0 ? (
          <Row
            label={`${p.name} plan — ${p.includedSeats} seats included`}
            value={`${money(p.base)}/mo`}
          />
        ) : (
          <Row label={`${p.name} plan — ${q.seats} users`} value={`${money(p.seatRate)}/user/mo`} />
        )}
        <Row
          label={`Additional seats (${q.extraSeats})`}
          value={q.extraSeats ? `${money(q.extraSeatCost)}/mo` : "—"}
        />
        <Row label={`Due on day ${CB_TRIAL_DAYS + 1}`} value={money(q.firstCharge)} strong />
        <Row label="Then every month" value={`${money(q.recurring)}/mo`} strong />
      </ul>

      <p className="text-[13px] leading-relaxed" style={{ color: "var(--cb-text-muted)" }}>
        Your first {CB_TRIAL_DAYS} days are free. Cancel any time before day {CB_TRIAL_DAYS + 1} and you are
        never charged. If you do not cancel, we bill {money(q.firstCharge)} on day {CB_TRIAL_DAYS + 1}, then{" "}
        {money(q.recurring)} every month, adjusted whenever you add or remove seats.
      </p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <li className="flex items-baseline justify-between gap-4">
      <span style={{ color: strong ? undefined : "var(--cb-text-muted)" }}>{label}</span>
      <span className={strong ? "font-bold" : "font-semibold"}>{value}</span>
    </li>
  );
}
