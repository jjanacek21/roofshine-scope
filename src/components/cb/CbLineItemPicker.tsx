import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { searchLineItems, type CbCatalogLineItem } from "@/lib/cbCatalogResolve";
import { CbButton } from "@/components/cb/primitives";

/**
 * Price book picker. Search line_item_master by code or name and pick the
 * real catalog line — the rep never types a description that has no code.
 */
export function CbLineItemPicker({
  open,
  trade,
  onPick,
  onClose,
}: {
  open: boolean;
  trade?: string | null;
  onPick: (item: CbCatalogLineItem) => void;
  onClose: () => void;
}) {
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<CbCatalogLineItem[]>([]);
  const [loading, setLoading] = useState(false);
  /* A rep often needs a line from another trade — let them widen the search. */
  const [allTrades, setAllTrades] = useState(false);
  const activeTrade = allTrades ? null : (trade ?? null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const data = await searchLineItems(term, activeTrade);
      if (!cancelled) {
        setRows(data);
        setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term, open, activeTrade]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ background: "rgba(0,0,0,.45)" }}>
      <div
        className="flex max-h-[85vh] w-full max-w-[640px] flex-col rounded-t-3xl sm:rounded-3xl"
        style={{ background: "var(--cb-surface)", border: "1px solid var(--cb-border)" }}
      >
        <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--cb-border)" }}>
          <Search className="h-4 w-4 opacity-60" />
          <input
            autoFocus
            className="h-11 flex-1 bg-transparent text-base outline-none"
            placeholder="Search the price book by code or name"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          <button type="button" aria-label="Close" className="rounded-lg p-2 opacity-60" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {trade ? (
          <div className="flex items-center gap-2 border-b px-4 py-2 text-xs" style={{ borderColor: "var(--cb-border)" }}>
            <button
              type="button"
              className="rounded-full border px-3 py-1"
              style={{
                borderColor: "var(--cb-border)",
                background: allTrades ? "transparent" : "var(--cb-accent-soft, rgba(0,0,0,.06))",
              }}
              onClick={() => setAllTrades(false)}
            >
              {trade}
            </button>
            <button
              type="button"
              className="rounded-full border px-3 py-1"
              style={{
                borderColor: "var(--cb-border)",
                background: allTrades ? "var(--cb-accent-soft, rgba(0,0,0,.06))" : "transparent",
              }}
              onClick={() => setAllTrades(true)}
            >
              All trades
            </button>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm opacity-70">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          ) : rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm opacity-70">No line items match that search.</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--cb-border)" }}>
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left"
                    onClick={() => {
                      onPick(r);
                      onClose();
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[15px] font-medium">{r.name}</span>
                      <span className="shrink-0 rounded-md border px-1.5 py-0.5 text-xs opacity-70" style={{ borderColor: "var(--cb-border)" }}>
                        {(r.unit ?? "EA").toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs opacity-60">
                      <span>{r.code ?? "—"}</span>
                      <span>
                        ${Number(r.default_price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t px-4 py-3" style={{ borderColor: "var(--cb-border)" }}>
          <CbButton variant="ghost" size="md" onClick={onClose}>
            Cancel
          </CbButton>
        </div>
      </div>
    </div>
  );
}
