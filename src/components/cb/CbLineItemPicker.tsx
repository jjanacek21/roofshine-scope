import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Loader2, Plus, Search, X } from "lucide-react";
import { searchLineItems, type CbCatalogLineItem } from "@/lib/cbCatalogResolve";
import {
  CB_UNGROUPED,
  cbTradeColor,
  loadSubgroupCounts,
  loadSubgroupItems,
  loadTradeCounts,
  searchPriceBook,
  type CbPriceBookItem,
  type CbSubgroupCount,
  type CbTrade,
  type CbTradeCount,
} from "@/lib/cbPriceBook";
import { CbButton } from "@/components/cb/primitives";

/**
 * Price book picker.
 *
 * Two modes, because a rep works two ways:
 *
 *  - `mode="search"` — the default, and exactly what the estimate route has
 *    always done: type a code, pick one line, the sheet closes. Unchanged.
 *
 *  - `mode="browse"` — open a trade, open a sub-group, tap + on every line you
 *    want, and the sheet stays put while a counter runs. That is how a roof
 *    actually gets scoped: you work through Flashings once, not one code at a
 *    time. Closing is an explicit act.
 *
 * `onPick` fires once per item in both modes, so any caller that appends a line
 * on pick keeps working with no change.
 */
export function CbLineItemPicker({
  open,
  trade,
  companyId,
  mode = "search",
  addedCodes,
  onPick,
  onClose,
}: {
  open: boolean;
  trade?: string | null;
  /** Scopes the book to this company's lines plus the shared ones. */
  companyId?: string | null;
  mode?: "search" | "browse";
  /** Codes already on the estimate, so browse mode can tick them. */
  addedCodes?: Set<string>;
  onPick: (item: CbCatalogLineItem) => void;
  onClose: () => void;
}) {
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<CbCatalogLineItem[]>([]);
  const [loading, setLoading] = useState(false);
  /* A rep often needs a line from another trade — let them widen the search. */
  const [allTrades, setAllTrades] = useState(false);
  const activeTrade = allTrades ? null : (trade ?? null);

  /* Browse state. */
  const [trades, setTrades] = useState<CbTradeCount[] | null>(null);
  const [openTrade, setOpenTrade] = useState<CbTrade | null>(null);
  const [subs, setSubs] = useState<Record<string, CbSubgroupCount[]>>({});
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, CbPriceBookItem[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [hits, setHits] = useState<CbPriceBookItem[] | null>(null);
  /* Ticks stay local so the sheet reflects a tap before the parent re-renders. */
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
  const [addedCount, setAddedCount] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const browsing = mode === "browse";

  const isAdded = useCallback(
    (code: string | null) => {
      if (!code) return false;
      return justAdded.has(code) || !!addedCodes?.has(code);
    },
    [justAdded, addedCodes],
  );

  /* ── search mode: the original behaviour, untouched ── */
  useEffect(() => {
    if (!open || browsing) return;
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
  }, [term, open, activeTrade, browsing]);

  /* ── browse mode: trade counts, once per open ── */
  useEffect(() => {
    if (!open || !browsing || trades) return;
    let cancelled = false;
    setLoading(true);
    loadTradeCounts(companyId)
      .then((t) => {
        if (cancelled) return;
        setTrades(t);
        /* Open the job's own trade first — it is what they came for. */
        const want = t.find((x) => x.trade === trade)?.trade ?? t[0]?.trade ?? null;
        if (want) setOpenTrade(want);
      })
      .catch((e) => {
        if (!cancelled) setErr((e as Error)?.message ?? "Could not load the price book");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, browsing, trades, companyId, trade]);

  /* Sub-groups for whichever trade is open. */
  useEffect(() => {
    if (!openTrade || subs[openTrade]) return;
    let cancelled = false;
    const key = openTrade;
    setBusy(key);
    loadSubgroupCounts(key, companyId)
      .then((s) => {
        if (!cancelled) setSubs((p) => ({ ...p, [key]: s }));
      })
      .catch((e) => {
        if (!cancelled) setErr((e as Error)?.message ?? "Could not load sub-groups");
      })
      .finally(() => {
        if (!cancelled) setBusy(null);
      });
    return () => {
      cancelled = true;
    };
  }, [openTrade, subs, companyId]);

  /* Items for whichever sub-group is open. */
  useEffect(() => {
    if (!openSub || items[openSub]) return;
    const key = openSub;
    const [t, ...rest] = key.split("|");
    const sub = rest.join("|");
    let cancelled = false;
    setBusy(key);
    loadSubgroupItems(t as CbTrade, sub, companyId)
      .then((i) => {
        if (!cancelled) setItems((p) => ({ ...p, [key]: i }));
      })
      .catch((e) => {
        if (!cancelled) setErr((e as Error)?.message ?? "Could not load line items");
      })
      .finally(() => {
        if (!cancelled) setBusy(null);
      });
    return () => {
      cancelled = true;
    };
  }, [openSub, items, companyId]);

  /* Browse-mode search short-circuits the tree. */
  useEffect(() => {
    if (!open || !browsing) return;
    const t = term.trim();
    if (!t) {
      setHits(null);
      return;
    }
    let cancelled = false;
    setBusy("search");
    const h = setTimeout(async () => {
      try {
        const data = await searchPriceBook(t, companyId);
        if (!cancelled) setHits(data);
      } catch (e) {
        if (!cancelled) setErr((e as Error)?.message ?? "Search failed");
      } finally {
        if (!cancelled) setBusy(null);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(h);
    };
  }, [term, open, browsing, companyId]);

  /* Reset the run counter each time the sheet opens. */
  useEffect(() => {
    if (!open) return;
    setAddedCount(0);
    setJustAdded(new Set());
    setErr(null);
    setTerm("");
  }, [open]);

  const add = useCallback(
    (item: CbPriceBookItem | CbCatalogLineItem) => {
      if (item.code && isAdded(item.code)) return;
      onPick(item);
      setAddedCount((n) => n + 1);
      if (item.code) {
        const code = item.code;
        setJustAdded((p) => new Set(p).add(code));
      }
    },
    [onPick, isAdded],
  );

  const addAll = useCallback(
    (key: string) => {
      const list = items[key] ?? [];
      let n = 0;
      const next = new Set(justAdded);
      list.forEach((i) => {
        if (i.code && (next.has(i.code) || addedCodes?.has(i.code))) return;
        onPick(i);
        if (i.code) next.add(i.code);
        n++;
      });
      setJustAdded(next);
      setAddedCount((c) => c + n);
    },
    [items, justAdded, addedCodes, onPick],
  );

  const money = useMemo(
    () => (n: number | null) =>
      `$${Number(n ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    [],
  );

  if (!open) return null;

  const itemRow = (r: CbPriceBookItem | CbCatalogLineItem, indent: boolean) => {
    const added = isAdded(r.code);
    return (
      <div
        key={r.id}
        className="flex items-center gap-2 border-t py-2 pr-3"
        style={{
          borderColor: "var(--cb-border)",
          paddingLeft: indent ? 22 : 12,
          background: added ? "color-mix(in srgb, var(--cb-accent) 7%, transparent)" : undefined,
        }}
      >
        <span
          className="shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] font-semibold opacity-70"
          style={{ borderColor: "var(--cb-border)" }}
        >
          {r.code ?? "—"}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13.5px]" title={r.name}>
          {r.name}
        </span>
        {/* The price is what a rep is deciding on — never hide it on a phone. */}
        <span className="shrink-0 font-mono text-[11.5px] opacity-70 sm:text-[12px]">
          {money(r.default_price)}/{(r.unit ?? "EA").toUpperCase()}
        </span>
        <button
          type="button"
          aria-label={added ? `${r.code ?? r.name} already added` : `Add ${r.code ?? r.name}`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border"
          style={{
            borderColor: added ? "var(--cb-accent)" : "var(--cb-border)",
            background: added ? "var(--cb-accent)" : "transparent",
            color: added ? "#fff" : "var(--cb-accent)",
          }}
          onClick={() => add(r)}
        >
          {added ? <Check className="h-4 w-4" /> : <Plus className="h-5 w-5" />}
        </button>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 flex items-end justify-center sm:items-center"
      /* Above .cb-dock (z-60) — the estimate screen's save bar otherwise
         swallows taps on this sheet's own footer. Below the doc overlay (z-90). */
      style={{ background: "rgba(0,0,0,.45)", zIndex: 70 }}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-[680px] flex-col rounded-t-3xl sm:rounded-3xl"
        style={{ background: "var(--cb-surface)", border: "1px solid var(--cb-border)" }}
      >
        <div
          className="flex items-center gap-2 border-b px-4 py-3"
          style={{ borderColor: "var(--cb-border)" }}
        >
          <Search className="h-4 w-4 opacity-60" />
          <input
            autoFocus
            className="h-11 flex-1 bg-transparent text-base outline-none"
            placeholder={
              browsing
                ? "Search by code, name or sub-group… or browse below"
                : "Search the price book by code or name"
            }
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          <button
            type="button"
            aria-label="Close"
            className="rounded-lg p-2 opacity-60"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {trade && !browsing ? (
          <div
            className="flex items-center gap-2 border-b px-4 py-2 text-xs"
            style={{ borderColor: "var(--cb-border)" }}
          >
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
          {err ? (
            <p
              className="px-4 py-6 text-center text-sm"
              style={{ color: "var(--danger, #dc2626)" }}
            >
              {err}
            </p>
          ) : null}

          {!browsing ? (
            /* ───────── search mode ───────── */
            loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm opacity-70">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </div>
            ) : rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm opacity-70">
                No line items match that search.
              </p>
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
                        <span
                          className="shrink-0 rounded-md border px-1.5 py-0.5 text-xs opacity-70"
                          style={{ borderColor: "var(--cb-border)" }}
                        >
                          {(r.unit ?? "EA").toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs opacity-60">
                        <span>{r.code ?? "—"}</span>
                        <span>{money(r.default_price)}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : hits ? (
            /* ───────── browse mode, searching ───────── */
            busy === "search" ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm opacity-70">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </div>
            ) : hits.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm opacity-70">Nothing matches “{term}”.</p>
            ) : (
              <>
                <p className="px-4 py-2 text-xs opacity-60">
                  {hits.length} match{hits.length === 1 ? "" : "es"}
                </p>
                {hits.map((r) => itemRow(r, false))}
              </>
            )
          ) : loading || !trades ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm opacity-70">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading the price book…
            </div>
          ) : (
            /* ───────── browse mode, the tree ───────── */
            trades.map((t) => {
              const isOpen = openTrade === t.trade;
              return (
                <div key={t.trade} className="border-b" style={{ borderColor: "var(--cb-border)" }}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
                    onClick={() => setOpenTrade(isOpen ? null : t.trade)}
                  >
                    <ChevronRight
                      className="h-3.5 w-3.5 shrink-0 opacity-60 transition-transform"
                      style={{ transform: isOpen ? "rotate(90deg)" : undefined }}
                    />
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: cbTradeColor(t.trade) }}
                    />
                    <span className="flex-1 text-[15px] font-semibold">{t.label}</span>
                    <span className="font-mono text-[12.5px] opacity-60">{t.count}</span>
                  </button>

                  {isOpen ? (
                    busy === t.trade && !subs[t.trade] ? (
                      <div className="flex items-center gap-2 px-11 pb-3 text-xs opacity-60">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading sub-groups…
                      </div>
                    ) : (
                      (subs[t.trade] ?? []).map((s) => {
                        const key = `${t.trade}|${s.subgroup}`;
                        const subOpen = openSub === key;
                        const list = items[key] ?? [];
                        return (
                          <div
                            key={key}
                            className="border-t"
                            style={{ borderColor: "var(--cb-border)" }}
                          >
                            <div className="flex items-center gap-2 pl-6 pr-3">
                              <button
                                type="button"
                                aria-expanded={subOpen}
                                className="flex min-h-11 flex-1 items-center gap-2 py-2 text-left"
                                onClick={() => setOpenSub(subOpen ? null : key)}
                              >
                                <ChevronRight
                                  className="h-3.5 w-3.5 shrink-0 opacity-60 transition-transform"
                                  style={{ transform: subOpen ? "rotate(90deg)" : undefined }}
                                />
                                <span className="flex-1 text-[14px] font-medium">{s.subgroup}</span>
                                <span className="font-mono text-[12px] opacity-60">{s.count}</span>
                              </button>
                              {subOpen && list.length ? (
                                <button
                                  type="button"
                                  className="shrink-0 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold"
                                  style={{
                                    borderColor: "var(--cb-border)",
                                    color: "var(--cb-accent)",
                                  }}
                                  onClick={() => addAll(key)}
                                >
                                  + Add all
                                </button>
                              ) : null}
                            </div>

                            {subOpen ? (
                              busy === key && !items[key] ? (
                                <div className="flex items-center gap-2 px-11 pb-3 text-xs opacity-60">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading items…
                                </div>
                              ) : list.length === 0 ? (
                                <p className="px-11 pb-3 text-xs opacity-60">
                                  No active lines here.
                                </p>
                              ) : (
                                <>
                                  {list.length >= 500 ? (
                                    <p className="px-11 pt-2 text-[11px] italic opacity-60">
                                      Showing the first 500 — search to narrow it.
                                    </p>
                                  ) : null}
                                  {list.map((r) => itemRow(r, true))}
                                </>
                              )
                            ) : null}
                          </div>
                        );
                      })
                    )
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div
          className="flex items-center gap-3 border-t px-4 py-3"
          style={{ borderColor: "var(--cb-border)" }}
        >
          {browsing ? (
            <>
              <span className="flex-1 text-[13px] opacity-70">
                {addedCount ? (
                  <>
                    <b className="font-mono" style={{ color: "var(--cb-accent)" }}>
                      {addedCount}
                    </b>{" "}
                    added · keep going
                  </>
                ) : (
                  "Nothing added yet"
                )}
              </span>
              <CbButton variant="secondary" size="md" onClick={onClose}>
                Done
              </CbButton>
            </>
          ) : (
            <CbButton variant="ghost" size="md" onClick={onClose}>
              Cancel
            </CbButton>
          )}
        </div>
      </div>
    </div>
  );
}
