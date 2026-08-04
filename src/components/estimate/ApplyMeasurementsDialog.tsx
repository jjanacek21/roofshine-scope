import { useMemo, useState } from "react";
import { Ruler, X } from "lucide-react";
import {
  buildFillSuggestions,
  measurementBasics,
  type FillTarget,
  type SavedMeasurement,
} from "@/lib/estimate-measurement-fill";

export function ApplyMeasurementsDialog({
  open,
  onClose,
  measurement,
  items,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  measurement: SavedMeasurement;
  items: FillTarget[];
  onApply: (changes: { id: string; qty: number }[]) => void;
}) {
  const suggestions = useMemo(
    () => buildFillSuggestions(items, measurement),
    [items, measurement],
  );
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const basics = measurementBasics(measurement);

  if (!open) return null;

  const selected = suggestions.filter((s) => !skipped.has(s.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl border shadow-xl"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Ruler className="h-4 w-4" /> Use saved measurements
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4" style={{ maxHeight: "60vh" }}>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            {[
              ["True area", `${basics.trueSqft.toLocaleString()} sf`],
              ["True squares", `${basics.trueSquares.toFixed(2)} SQ`],
              ["Waste", `${basics.wastePct}%`],
              ["With waste", `${basics.wasteSquares.toFixed(2)} SQ`],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border p-2"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="text-muted-foreground">{label}</div>
                <div className="font-mono-num text-sm font-semibold">{value}</div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Removal / tear-off lines use the true roof area with no waste. Install and replace
            lines include the {basics.wastePct}% waste factor.
          </p>

          {suggestions.length === 0 ? (
            <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground" style={{ borderColor: "var(--border)" }}>
              No line items match the saved measurements yet. Add roofing or linear-foot items
              first, then apply.
            </div>
          ) : (
            <div className="space-y-1.5">
              {suggestions.map((s) => {
                const on = !skipped.has(s.id);
                return (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md border p-2 text-xs"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setSkipped((prev) => {
                          const next = new Set(prev);
                          if (on) next.add(s.id);
                          else next.delete(s.id);
                          return next;
                        })
                      }
                    />
                    <span className="flex-1 truncate font-medium">{s.name}</span>
                    <span className="text-muted-foreground">{s.basis}</span>
                    <span className="font-mono-num w-32 text-right">
                      {s.currentQty} → <strong>{s.newQty}</strong> {s.unit}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-end gap-2 border-t px-5 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <button onClick={onClose} className="btn-ghost h-9 rounded-lg px-3.5 text-[13px] font-semibold">
            Cancel
          </button>
          <button
            disabled={selected.length === 0}
            onClick={() => {
              onApply(selected.map((s) => ({ id: s.id, qty: s.newQty })));
              onClose();
            }}
            className="btn-primary h-9 rounded-lg px-3.5 text-[13px] font-semibold disabled:opacity-50"
          >
            Apply to {selected.length} item{selected.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}
