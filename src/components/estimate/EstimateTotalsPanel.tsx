import { Send, FileDown, Check, Eye, EyeOff } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export type EstimatePctEdits = {
  markup_pct: number;
  overhead_pct: number;
  profit_pct: number;
  tax_pct: number;
};

export function EstimateTotalsPanel({
  jobId,
  tierLabel,
  subtotal,
  pcts,
  onPctChange,
  hidePricing,
  onTogglePricing,
  savedAt,
}: {
  jobId: string;
  tierLabel: string;
  subtotal: number;
  pcts: EstimatePctEdits;
  onPctChange: (patch: Partial<EstimatePctEdits>) => void;
  hidePricing: boolean;
  onTogglePricing: () => void;
  savedAt: number | null;
}) {
  const markup = (subtotal * pcts.markup_pct) / 100;
  const overhead = (subtotal * pcts.overhead_pct) / 100;
  const profit = (subtotal * pcts.profit_pct) / 100;
  const beforeTax = subtotal + markup + overhead + profit;
  const tax = (beforeTax * pcts.tax_pct) / 100;
  const grandTotal = beforeTax + tax;

  const savedLabel = savedAt ? relativeTime(savedAt) : null;

  return (
    <div
      className="sticky top-4 space-y-3 rounded-xl border p-5"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Totals · {tierLabel}
        </h3>
        {savedLabel && (
          <span className="flex items-center gap-1 text-[10px] text-[var(--success)]">
            <Check className="h-3 w-3" />
            Saved {savedLabel}
          </span>
        )}
      </div>

      <Row label="Subtotal" value={subtotal} bold />

      <PctRow
        label="Markup"
        pct={pcts.markup_pct}
        amount={markup}
        onChange={(v) => onPctChange({ markup_pct: v })}
      />
      <PctRow
        label="Overhead"
        pct={pcts.overhead_pct}
        amount={overhead}
        onChange={(v) => onPctChange({ overhead_pct: v })}
      />
      <PctRow
        label="Profit"
        pct={pcts.profit_pct}
        amount={profit}
        onChange={(v) => onPctChange({ profit_pct: v })}
      />
      <PctRow
        label="Tax"
        pct={pcts.tax_pct}
        amount={tax}
        onChange={(v) => onPctChange({ tax_pct: v })}
      />

      <div
        className="-mx-5 mt-3 border-t px-5 pt-3"
        style={{ borderColor: "var(--border-bright)" }}
      >
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Grand Total
          </span>
          <span
            className="font-mono-num font-extrabold text-[var(--brand)]"
            style={{ fontSize: 22 }}
          >
            ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <Link
          to="/jobs/$id/report"
          params={{ id: jobId }}
          className="btn-brand flex h-10 w-full items-center justify-center gap-2 rounded-lg text-[13px] font-bold"
        >
          <FileDown className="h-4 w-4" />
          Generate PDF Proposal
        </Link>
        <button
          onClick={() => toast.info("Email integration coming in next build")}
          className="btn-ghost flex h-10 w-full items-center justify-center gap-2 rounded-lg text-[13px] font-semibold"
        >
          <Send className="h-4 w-4" />
          Send to Client
        </button>
        <button
          onClick={onTogglePricing}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border text-[12px] font-semibold text-muted-foreground hover:text-foreground"
          style={{ borderColor: "var(--border)" }}
        >
          {hidePricing ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {hidePricing ? "Show pricing" : "Hide pricing in PDF"}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span
        className={`font-mono-num text-[14px] ${bold ? "font-bold text-foreground" : "text-foreground"}`}
      >
        ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}

function PctRow({
  label,
  pct,
  amount,
  onChange,
}: {
  label: string;
  pct: number;
  amount: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="number"
            value={pct}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
            className="font-mono-num w-14 rounded border bg-[var(--bg-elevated)] px-1.5 py-0.5 text-right text-[12px] outline-none focus:border-[var(--brand)]"
            style={{ borderColor: "var(--border)" }}
            step="0.5"
          />
          <span className="ml-1 text-[10px] text-muted-foreground">%</span>
        </div>
        <span className="font-mono-num w-20 text-right text-[12px] text-muted-foreground">
          ${amount.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function relativeTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 5000) return "now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}
