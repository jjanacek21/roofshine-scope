import { useState } from "react";
import { TRADES, type Trade } from "@/lib/trades";
import { X } from "lucide-react";

export type CustomItemDraft = {
  name: string;
  trade: Trade;
  unit: string;
  qty: number;
  unit_price: number;
  code: string | null;
};

export function AddCustomItemDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (draft: CustomItemDraft) => void;
}) {
  const [name, setName] = useState("");
  const [trade, setTrade] = useState<Trade>("roofing");
  const [unit, setUnit] = useState("EA");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [code, setCode] = useState("");

  if (!open) return null;

  const submit = () => {
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      trade,
      unit: unit || "EA",
      qty: Number(qty) || 1,
      unit_price: Number(price) || 0,
      code: code.trim() || null,
    });
    setName("");
    setQty(1);
    setPrice(0);
    setCode("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-md rounded-t-2xl border p-5 shadow-2xl sm:rounded-2xl"
        style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-bright)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">Add custom line item</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-[var(--bg-hover)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Custom skylight flashing kit"
              className="w-full rounded-lg border bg-[var(--bg-card)] px-3 py-2 text-[13px] outline-none focus:border-[var(--brand)]"
              style={{ borderColor: "var(--border)" }}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Trade
              </label>
              <select
                value={trade}
                onChange={(e) => setTrade(e.target.value as Trade)}
                className="w-full rounded-lg border bg-[var(--bg-card)] px-3 py-2 text-[13px] outline-none"
                style={{ borderColor: "var(--border)" }}
              >
                {TRADES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Code (optional)
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="—"
                className="w-full rounded-lg border bg-[var(--bg-card)] px-3 py-2 text-[13px] outline-none"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Qty
              </label>
              <input
                type="number"
                step="0.01"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="font-mono-num w-full rounded-lg border bg-[var(--bg-card)] px-3 py-2 text-[13px] outline-none"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Unit
              </label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value.toUpperCase())}
                className="font-mono-num w-full rounded-lg border bg-[var(--bg-card)] px-3 py-2 text-[13px] outline-none"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Price
              </label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="font-mono-num w-full rounded-lg border bg-[var(--bg-card)] px-3 py-2 text-[13px] outline-none"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="btn-ghost h-9 rounded-lg px-3.5 text-[13px] font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              className="btn-brand h-9 rounded-lg px-3.5 text-[13px] font-semibold"
            >
              Add item
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
