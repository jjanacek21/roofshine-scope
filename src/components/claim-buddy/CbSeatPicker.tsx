import {
  CB_INCLUDED_SEATS,
  CB_MAX_SEATS,
  CB_MONTHLY_BASE,
  CB_FIRST_MONTH,
  CB_TRIAL_DAYS,
  money,
  quoteSeats,
  seatRateLabel,
  clampSeats,
} from "@/lib/cbPricing";

type Props = {
  seats: number;
  onChange: (seats: number) => void;
};

/** Seat selector + live price breakdown used on signup and in billing settings. */
export function CbSeatPicker({ seats, onChange }: Props) {
  const q = quoteSeats(seats);
  const set = (n: number) => onChange(clampSeats(n));

  return (
    <div className="space-y-5">
      <div
        className="rounded-2xl p-4"
        style={{ background: "var(--cb-surface, #fff)", border: "1px solid var(--cb-border, #e2e8e5)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[15px] font-semibold">Team seats</div>
            <div className="text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
              {CB_INCLUDED_SEATS} seats included · up to {CB_MAX_SEATS}
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
              onChange={(e) => set(Number(e.target.value.replace(/\D/g, "")) || CB_INCLUDED_SEATS)}
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
          min={CB_INCLUDED_SEATS}
          max={CB_MAX_SEATS}
          value={q.seats}
          aria-label="Seats slider"
          onChange={(e) => set(Number(e.target.value))}
          className="mt-4 w-full"
        />
        <div className="mt-1 text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
          {seatRateLabel(q.seats)}
        </div>
      </div>

      <ul className="space-y-2 text-[14px]">
        <Row label={`Owner plan — ${CB_INCLUDED_SEATS} seats + custom price book`} value={`${money(CB_FIRST_MONTH)} first month`} />
        <Row
          label={`Additional seats (${q.extraSeats})`}
          value={q.extraSeats ? `${money(q.extraSeatCost)}/mo` : "—"}
        />
        <Row label={`Due on day ${CB_TRIAL_DAYS + 1}`} value={money(q.firstCharge)} strong />
        <Row label={`Then monthly (${money(CB_MONTHLY_BASE)} base + seats)`} value={`${money(q.recurring)}/mo`} strong />
      </ul>

      <p className="text-[13px] leading-relaxed" style={{ color: "var(--cb-text-muted)" }}>
        Your first {CB_TRIAL_DAYS} days are free. Cancel any time before day {CB_TRIAL_DAYS + 1} and you are
        never charged the {money(CB_FIRST_MONTH)} or the {money(CB_MONTHLY_BASE)}/mo after it. If you do not
        cancel, we bill {money(q.firstCharge)} on day {CB_TRIAL_DAYS + 1}, then {money(q.recurring)} every
        month, adjusted whenever you add or remove seats.
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
