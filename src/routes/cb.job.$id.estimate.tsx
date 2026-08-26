import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Download, Loader2, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbChip, CbBadge, CbLoading } from "@/components/cb/primitives";
import { CbStickyHeader, CbReveal, cbHaptic } from "@/components/cb/motion";
import { CbField, CbSegmentedCards } from "@/components/cb/forms";
import { CbConvertAction } from "@/components/cb/CbConvertAction";
import {
  buildCbDraft,
  computeTotals,
  loadCbEstimateInputs,
  measurementIsComplete,
  perSquareMath,
  saveCbEstimate,
  mergeCbDraft,
  cbLineKey,
  CB_SOURCE_LABEL,
  type CbDraftLine,
  type CbEstimateMode,
  type CbEstimatePercents,
  type CbEstimateProvenance,
} from "@/lib/cbEstimate";
import { renderCbEstimatePdf } from "@/lib/cbEstimatePdf";
import { CbLineItemPicker } from "@/components/cb/CbLineItemPicker";
import { CbCarrierReport } from "@/components/cb/CbCarrierReport";
import { generateEstimatePdf } from "@/lib/estimate-pdf";
import { useCbFeature, useCbFeatureGuard } from "@/components/claim-buddy/CbFeatureGate";

export const Route = createFileRoute("/cb/job/$id/estimate")({
  head: () => ({
    meta: [
      { title: "Estimate — Claim Buddy" },
      {
        name: "description",
        content:
          "Build the repair estimate straight off the measurement and takeoff — a price per square for the driveway, or a full carrier-style line item build.",
      },
      { property: "og:title", content: "Estimate — Claim Buddy" },
      { property: "og:description", content: "Price per square or full line item, from the same inspection." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbEstimatePage,
});

const money = (v: number) =>
  `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qtyFmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });

function CbEstimatePage() {
  const { id } = useParams({ from: "/cb/job/$id/estimate" });
  const navigate = useNavigate();

  const { data: inputs, isLoading } = useQuery({
    queryKey: ["cb-estimate-inputs", id],
    queryFn: () => loadCbEstimateInputs(id),
    /* Re-entering the screen must show what was saved, never a refetch race. */
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const [mode, setMode] = useState<CbEstimateMode | null>(null);
  const featureGuard = useCbFeatureGuard();
  const priceBookAllowed = useCbFeature("price_book").allowed;
  const [lines, setLines] = useState<CbDraftLine[]>([]);
  const [pps, setPps] = useState(0);
  const [pct, setPct] = useState<CbEstimatePercents>({
    markup_pct: 0,
    overhead_pct: 0,
    profit_pct: 0,
    tax_pct: 0,
  });
  const [attach, setAttach] = useState(true);
  const [bookName, setBookName] = useState<string | null>(null);
  const [provenance, setProvenance] = useState<CbEstimateProvenance | null>(null);
  const [building, setBuilding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  /** null = closed, "new" = append a line, otherwise the line id being replaced */
  const [picking, setPicking] = useState<string | null>(null);
  /** The estimate row this screen owns — every save updates it, never inserts. */
  const [estimateId, setEstimateId] = useState<string | null>(null);
  /** Derived lines the rep deleted. A rebuild is not allowed to bring them back. */
  const [removedKeys, setRemovedKeys] = useState<string[]>([]);

  /** Codes already on the estimate, so the browse sheet can tick them. */
  const addedCodes = useMemo(
    () => new Set(lines.map((l) => l.code).filter((c): c is string => !!c)),
    [lines],
  );
  const [askRebuild, setAskRebuild] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  /* first load — mode defaults to whichever the measurement can support */
  useEffect(() => {
    if (!inputs || mode) return;
    const saved = inputs.existing?.estimate.cb_mode as CbEstimateMode | undefined;
    const initial: CbEstimateMode =
      saved ?? (measurementIsComplete(inputs.measurement) ? "line_item" : "per_square");
    setMode(initial === "line_item" && !priceBookAllowed ? "per_square" : initial);
    setPct(inputs.percents);
    setPps(
      Number(inputs.existing?.estimate.price_per_square) || inputs.defaultPricePerSquare || 0,
    );
    if (inputs.existing) {
      /*
       * An estimate that exists is loaded exactly as saved — including an empty
       * one. Re-deriving here is what made deleted lines reappear.
       */
      setEstimateId(inputs.existing.estimate.id as string);
      setRemovedKeys(inputs.existing.removedKeys);
      setLines(inputs.existing.lines);
      const meta = inputs.existing.estimate.report_meta as { attach_to_report?: boolean } | null;
      if (meta && typeof meta.attach_to_report === "boolean") setAttach(meta.attach_to_report);
    } else {
      void rebuild(initial, [], []);
    }
  }, [inputs]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Re-derive from the takeoff and fold the result into what is on screen.
   * Only ever runs when the rep asks for it, or on a brand new estimate.
   */
  async function rebuild(next: CbEstimateMode, keep: CbDraftLine[], removed: string[]) {
    if (!inputs) return;
    setBuilding(true);
    try {
      const { lines: built, bookName: book, provenance: prov } = await buildCbDraft(inputs, next);
      setLines(mergeCbDraft(keep, built, removed));
      setBookName(book);
      setProvenance(prov);
      if (prov.error) toast.error(prov.error);
    } catch {
      toast.error("Couldn't build the estimate — try again");
    } finally {
      setBuilding(false);
    }
  }

  const manualCount = lines.filter((l) => l.is_manual).length;

  function confirmRebuild() {
    if (!mode) return;
    setAskRebuild(false);
    cbHaptic();
    void rebuild(mode, lines, removedKeys);
  }

  /**
   * Switching mode changes how the same scope is presented — nothing is
   * re-derived, so an edit made in one mode is still there in the other.
   */
  function changeMode(next: CbEstimateMode) {
    /* Carrier-style line items come from the Xactimate price book — Elite only. */
    if (next === "line_item" && !featureGuard("price_book")) return;
    cbHaptic();
    setMode(next);
    markDirty();
  }

  const totals = useMemo(() => computeTotals(lines, pct), [lines, pct]);
  const math = useMemo(
    () => perSquareMath(inputs?.measurement ?? null, pps),
    [inputs?.measurement, pps],
  );
  const perSquare = mode === "per_square";

  /* ----------------------------- persistence ---------------------------- */

  const dirty = useRef(false);
  const carrierRef = useRef<HTMLDivElement>(null);
  const markDirty = () => {
    dirty.current = true;
  };

  /** Everything a save needs, read through a ref so unmount can still save. */
  const snapshot = useRef({ inputs, mode, lines, pct, pps, attach, estimateId, removedKeys, provenance });
  snapshot.current = { inputs, mode, lines, pct, pps, attach, estimateId, removedKeys, provenance };

  const persist = useCallback(async (): Promise<boolean> => {
    const s = snapshot.current;
    if (!s.inputs || !s.mode) return false;
    const savedId = await saveCbEstimate({
      inputs: s.inputs,
      mode: s.mode,
      lines: s.lines.filter((l) => l.name.trim()),
      percents: s.pct,
      pricePerSquare: s.pps,
      attachToReport: s.attach,
      catalogVersionId: s.provenance?.catalogVersionId ?? null,
      estimateId: s.estimateId,
      removedKeys: s.removedKeys,
    });
    if (!s.estimateId) setEstimateId(savedId);
    dirty.current = false;
    return true;
  }, []);

  /* autosave — the rep should never lose an edit by leaving the screen */
  useEffect(() => {
    if (!mode || building || !dirty.current) return;
    const t = setTimeout(() => {
      void persist()
        .then(() => setSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })))
        .catch(() => toast.error("Couldn't save that change — tap Save estimate"));
    }, 1200);
    return () => clearTimeout(t);
  }, [lines, pct, pps, attach, mode, building, persist]);

  useEffect(
    () => () => {
      if (dirty.current) void persist().catch(() => undefined);
    },
    [persist],
  );

  /* ------------------------------- editing ------------------------------ */

  /** Any hand edit pins the line — a rebuild carries it through untouched. */
  function editLine(lineId: string, patch: Partial<CbDraftLine>) {
    markDirty();
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, ...patch, is_manual: true } : l)),
    );
  }

  function removeLine(lineId: string) {
    cbHaptic();
    markDirty();
    const line = lines.find((l) => l.id === lineId);
    if (line && !line.is_manual) setRemovedKeys((prev) => [...new Set([...prev, cbLineKey(line)])]);
    setLines((prev) => prev.filter((x) => x.id !== lineId));
  }

  function addLine() {
    cbHaptic();
    markDirty();
    setLines((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2, 10),
        line_item_id: null,
        code: null,
        name: "",
        unit: "EA",
        qty: 1,
        unit_price: 0,
        trade: "roofing",
        category: null,
        source: "manual",
        basis: "Added by hand",
        is_manual: true,
      },
    ]);
  }

  function moveLine(lineId: string, delta: number) {
    cbHaptic();
    markDirty();
    setLines((prev) => {
      const i = prev.findIndex((l) => l.id === lineId);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function applyPick(item: {
    id: string;
    code: string | null;
    name: string;
    unit: string | null;
    trade: string | null;
    category: string | null;
    default_price: number | null;
  }) {
    markDirty();
    const patch = {
      line_item_id: item.id,
      code: item.code,
      name: item.name,
      unit: (item.unit ?? "EA").toUpperCase(),
      unit_price: Number(item.default_price ?? 0),
      trade: item.trade,
      category: item.category,
      source: "manual" as const,
      basis: "Picked from the price book",
      is_manual: true,
    };
    if (picking === "new") {
      setLines((prev) => [...prev, { id: Math.random().toString(36).slice(2, 10), qty: 1, ...patch }]);
    } else if (picking) {
      editLine(picking, patch);
    }
  }

  async function save(): Promise<boolean> {
    setBusy("save");
    try {
      const ok = await persist();
      if (ok) {
        cbHaptic();
        toast.success("Estimate saved");
        setSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      }
      return ok;
    } catch {
      toast.error("Couldn't save the estimate");
      return false;
    } finally {
      setBusy(null);
    }
  }


  async function download() {
    if (!inputs || !mode) return;
    setBusy("pdf");
    try {
      /* Full line item mode downloads the carrier-format document. */
      if (mode === "line_item" && carrierRef.current) {
        await generateEstimatePdf(carrierRef.current, `estimate-${inputs.job.address ?? "claim-buddy"}.pdf`);
        return;
      }
      const blob = await renderCbEstimatePdf({
        mode,
        lines: lines.filter((l) => l.name.trim()),
        percents: pct,
        pricePerSquare: pps,
        measurement: inputs.measurement,
        company: (inputs.company as never) ?? null,
        property: {
          customer: inputs.job.customer_name,
          address: [inputs.job.address, inputs.job.city, inputs.job.state].filter(Boolean).join(", "),
          claim: null,
        },
        bookName,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `estimate-${inputs.job.address ?? "claim-buddy"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't build the PDF");
    } finally {
      setBusy(null);
    }
  }


  if (isLoading || !mode) {
    return (
      <CbSurface>
        <div className="min-h-screen px-5 py-16" style={{ background: "var(--cb-bg)" }}>
          <div className="mx-auto max-w-[820px]">
            <CbLoading label="Opening the estimate…" />
          </div>
        </div>
      </CbSurface>
    );
  }

  return (
    <CbSurface>
      <div className="min-h-screen pb-40" style={{ background: "var(--cb-bg)" }}>
        <CbStickyHeader>
          <div className="mx-auto flex max-w-[820px] items-center justify-between px-5 py-3">
            <button
              type="button"
              className="text-sm opacity-70"
              onClick={() => navigate({ to: "/cb/job/$id/report", params: { id }, search: { r: undefined } })}
            >
              ← Report
            </button>
            <span className="text-sm font-semibold">Estimate</span>
            <CbButton size="md" variant="ghost" onClick={() => setAskRebuild(true)} disabled={building}>
              {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </CbButton>
          </div>
        </CbStickyHeader>

        <div className="mx-auto max-w-[820px] space-y-5 px-5 pt-5">
          {provenance?.error ? (
            <CbReveal>
              <CbCard style={{ padding: 20, borderColor: "var(--cb-danger, #b42318)" }}>
                <h2 className="text-base font-semibold" style={{ color: "var(--cb-danger, #b42318)" }}>
                  {provenance.error}
                </h2>
                <p className="mt-2 text-sm opacity-75">
                  Nothing was substituted — no lines were generated. Set the roof system on the roof
                  takeoff, or have an assembly added for this system, then rebuild.
                </p>
                <div className="mt-4">
                  <CbButton
                    size="md"
                    variant="secondary"
                    onClick={() => navigate({ to: "/cb/job/$id/roof", params: { id } })}
                  >
                    Fix the roof takeoff
                  </CbButton>
                </div>
              </CbCard>
            </CbReveal>
          ) : provenance ? (
            <CbReveal>
              <CbCard style={{ padding: 16 }}>
                <p className="text-xs font-semibold uppercase tracking-wide opacity-60">
                  How this estimate was built
                </p>
                <ul className="mt-2 space-y-1 text-xs">
                  <li>
                    Roof system: <strong>{provenance.roofSystem ?? "not recorded"}</strong>
                  </li>
                  <li>
                    Assembly: <strong>{provenance.assemblyLabel ?? "none"}</strong>
                  </li>
                  <li>
                    Code rule set:{" "}
                    <strong>
                      {provenance.codeRuleSetName
                        ? `${provenance.codeRuleSetName} — ${provenance.codeRulesApplied} rule${
                            provenance.codeRulesApplied === 1 ? "" : "s"
                          } applied`
                        : "none for this jurisdiction"}
                    </strong>
                  </li>
                  <li>
                    Price book: <strong>{provenance.priceBookName ?? "none resolved — using catalog defaults"}</strong>
                  </li>
                  <li>
                    Catalog version:{" "}
                    <strong>{provenance.catalogVersionId ? provenance.catalogVersionId.slice(0, 8) : "none"}</strong>
                  </li>
                  {provenance.unmappedCount > 0 ? (
                    <li className="opacity-80">
                      {provenance.unmappedCount} checked item
                      {provenance.unmappedCount === 1 ? " has" : "s have"} no mapping in this catalog yet
                    </li>
                  ) : null}
                </ul>
              </CbCard>
            </CbReveal>
          ) : null}

          <CbReveal>
            <CbCard style={{ padding: 16 }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Scope from the takeoff</p>
                  <p className="text-xs opacity-65">
                    {manualCount > 0
                      ? `${manualCount} line${manualCount === 1 ? "" : "s"} you edited by hand — a rebuild keeps them exactly as they are.`
                      : "Rebuilding pulls fresh quantities from the measurement and takeoff."}
                    {removedKeys.length > 0
                      ? ` ${removedKeys.length} removed line${removedKeys.length === 1 ? "" : "s"} stay removed.`
                      : ""}
                  </p>
                </div>
                <CbButton size="md" variant="secondary" onClick={() => setAskRebuild(true)} disabled={building}>
                  <RefreshCw className="mr-1 h-4 w-4" /> Rebuild
                </CbButton>
              </div>
              {savedAt ? <p className="mt-2 text-xs opacity-55">Saved at {savedAt}</p> : null}
            </CbCard>
          </CbReveal>

          {askRebuild ? (
            <CbReveal>
              <CbCard style={{ padding: 20 }}>
                <h2 className="text-base font-semibold">Rebuild from the takeoff?</h2>
                <p className="mt-2 text-sm opacity-70">
                  Quantities and prices on untouched lines are refreshed. Your own edits and the
                  lines you deleted are left alone.
                </p>
                <div className="mt-4 flex gap-2">
                  <CbButton size="md" onClick={confirmRebuild}>Rebuild</CbButton>
                  <CbButton size="md" variant="ghost" onClick={() => setAskRebuild(false)}>
                    Cancel
                  </CbButton>
                </div>
              </CbCard>
            </CbReveal>
          ) : null}

          <CbReveal>
            <CbSegmentedCards
              value={mode}
              onChange={(v) => changeMode(v as CbEstimateMode)}
              options={[
                {
                  value: "per_square" as const,
                  title: "Price per square",
                  body: "One number, quoted from the driveway",
                },
                {
                  value: "line_item" as const,
                  title: priceBookAllowed ? "Full line item" : "Full line item (Elite)",
                  body: priceBookAllowed
                    ? "Carrier-style build with codes and pricing"
                    : "Xactimate price book — upgrade to unlock",
                },
              ]}
            />
          </CbReveal>

          {perSquare ? (
            <CbReveal>
              <CbCard style={{ padding: 20 }}>
                <CbField
                  label="Price per square"
                  type="number"
                  inputMode="decimal"
                  value={pps ? String(pps) : ""}
                  onChange={(e) => {
                    markDirty();
                    setPps(Number(e.target.value) || 0);
                  }}
                  hint="Saved as this workspace's default for the next inspection"
                />
                <p className="mt-4 text-sm opacity-70">{math.sentence}</p>
                <div className="mt-4 flex items-baseline justify-between border-t pt-4" style={{ borderColor: "var(--cb-border)" }}>
                  <span className="text-sm opacity-70">Total</span>
                  <span className="text-3xl font-bold">{money(math.total)}</span>
                </div>
              </CbCard>
            </CbReveal>
          ) : null}

          <CbReveal>
            <CbCard style={{ padding: 0, overflow: "hidden" }}>
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold">
                    {perSquare ? "What's included" : "Line items"}
                  </h2>
                  <p className="text-xs opacity-60">
                    {perSquare
                      ? "Shown without quantities or prices — the single total is below"
                      : bookName
                        ? `Priced from ${bookName}`
                        : ""}
                  </p>
                </div>
                <CbBadge>{lines.length}</CbBadge>
              </div>

              {building ? (
                <div className="px-5 pb-6">
                  <CbLoading label="Building the scope…" />
                </div>
              ) : (
                <ul className="divide-y" style={{ borderColor: "var(--cb-border)" }}>
                  {lines.map((l) => (
                    <li key={l.id} className="px-5 py-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                        <div className="min-w-0 flex-1">
                          <input
                            className="w-full bg-transparent text-[15px] font-medium outline-none"
                            value={l.name}
                            placeholder="Description"
                            onChange={(e) => editLine(l.id, { name: e.target.value })}
                          />
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {l.code ? <CbChip>{l.code}</CbChip> : null}
                            <CbChip>{CB_SOURCE_LABEL[l.source]}</CbChip>
                            {l.is_manual ? <CbChip>Your edit</CbChip> : null}
                            {l.basis ? <span className="text-xs opacity-60">{l.basis}</span> : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 self-end sm:self-auto">

                          <button
                            type="button"
                            aria-label="Pick from the price book"
                            className="rounded-lg p-2 opacity-60"
                            onClick={() => setPicking(l.id)}
                          >
                            <Search className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Move up"
                            className="rounded-lg p-2 opacity-50"
                            onClick={() => moveLine(l.id, -1)}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Move down"
                            className="rounded-lg p-2 opacity-50"
                            onClick={() => moveLine(l.id, 1)}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Remove line"
                            className="rounded-lg p-2 opacity-50"
                            onClick={() => removeLine(l.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {!perSquare ? (
                        <div className="mt-3 grid grid-cols-4 items-center gap-2">
                          <input
                            className="h-11 rounded-xl border px-3 text-right text-sm"
                            style={{ borderColor: "var(--cb-border)", background: "var(--cb-surface)" }}
                            type="number"
                            inputMode="decimal"
                            value={l.qty}
                            aria-label="Quantity"
                            onChange={(e) => editLine(l.id, { qty: Number(e.target.value) || 0 })}
                          />
                          <input
                            className="h-11 rounded-xl border px-3 text-sm uppercase"
                            style={{ borderColor: "var(--cb-border)", background: "var(--cb-surface)" }}
                            value={l.unit}
                            aria-label="Unit"
                            onChange={(e) => editLine(l.id, { unit: e.target.value.toUpperCase() })}
                          />
                          <input
                            className="h-11 rounded-xl border px-3 text-right text-sm"
                            style={{ borderColor: "var(--cb-border)", background: "var(--cb-surface)" }}
                            type="number"
                            inputMode="decimal"
                            value={l.unit_price}
                            aria-label="Unit price"
                            onChange={(e) => editLine(l.id, { unit_price: Number(e.target.value) || 0 })}
                          />
                          <div className="text-right text-sm font-semibold">
                            {money(l.qty * l.unit_price)}
                          </div>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap gap-2 px-5 py-4">
                <CbButton variant="ghost" size="md" onClick={() => setPicking("new")}>
                  <Search className="mr-1 h-4 w-4" /> Add line items
                </CbButton>
                <CbButton variant="ghost" size="md" onClick={addLine}>
                  <Plus className="mr-1 h-4 w-4" /> Blank line
                </CbButton>
              </div>
            </CbCard>
          </CbReveal>

          {!perSquare ? (
            <CbReveal>
              <CbCard style={{ padding: 20 }}>
                <h2 className="mb-4 text-base font-semibold">Totals</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(
                    [
                      ["markup_pct", "Markup %"],
                      ["overhead_pct", "Overhead %"],
                      ["profit_pct", "Profit %"],
                      ["tax_pct", "Sales tax %"],
                    ] as [keyof CbEstimatePercents, string][]
                  ).map(([key, label]) => (
                    <CbField
                      key={key}
                      label={label}
                      type="number"
                      inputMode="decimal"
                      value={String(pct[key] ?? 0)}
                      onChange={(e) => {
                        markDirty();
                        setPct((p) => ({ ...p, [key]: Number(e.target.value) || 0 }));
                      }}
                    />
                  ))}
                </div>
                <dl className="mt-5 space-y-2 border-t pt-4 text-sm" style={{ borderColor: "var(--cb-border)" }}>
                  {(
                    [
                      ["Subtotal", totals.subtotal],
                      ["Markup", totals.markup],
                      ["Overhead", totals.overhead],
                      ["Profit", totals.profit],
                      ["Sales tax", totals.tax],
                    ] as [string, number][]
                  ).map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <dt className="opacity-65">{label}</dt>
                      <dd>{money(value)}</dd>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between pt-2 text-lg font-bold">
                    <dt>Total</dt>
                    <dd>{money(totals.total)}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs opacity-60">
                  {qtyFmt(lines.length)} line items priced from the master catalog.
                </p>
              </CbCard>
            </CbReveal>
          ) : null}

          <CbReveal>
            <CbCard style={{ padding: 20 }}>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="cb-checkbox"
                  checked={attach}
                  onChange={(e) => {
                    markDirty();
                    setAttach(e.target.checked);
                  }}
                />
                Attach this estimate to the damage report
              </label>
            </CbCard>
          </CbReveal>

          {inputs ? <CbConvertAction jobId={id} /> : null}
        </div>

        <div className="cb-dock">
          <div className="mx-auto flex w-full max-w-[820px] items-center gap-3">
            <CbButton variant="ghost" onClick={() => void download()} disabled={busy === "pdf"}>
              {busy === "pdf" ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1 h-4 w-4" />
              )}
              PDF
            </CbButton>
            <CbButton className="flex-1" onClick={() => void save()} disabled={busy === "save"}>
              {busy === "save" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Save estimate — {money(perSquare ? math.total : totals.total)}
            </CbButton>
          </div>
        </div>
      </div>

      {/* Offscreen carrier document — the source for the PDF download. */}
      {mode === "line_item" && inputs ? (
        <div aria-hidden style={{ position: "fixed", left: -10000, top: 0, width: 816 }}>
          <div ref={carrierRef}>
            <CbCarrierReport
              lines={lines.filter((l) => l.name.trim())}
              percents={pct}
              company={(inputs.company as never) ?? null}
              job={(inputs.job as never) ?? null}
              bookName={bookName}
            />
          </div>
        </div>
      ) : null}

      {/*
        Adding fresh lines browses the book by trade and sub-group and stays open,
        so a rep can take a whole sub-group in one pass. Swapping the code on an
        existing line is a single decision, so that keeps the search list that
        closes on pick.
      */}
      <CbLineItemPicker
        open={picking !== null}
        mode={picking === "new" ? "browse" : "search"}
        companyId={inputs?.companyId ?? null}
        addedCodes={addedCodes}
        trade={
          picking && picking !== "new"
            ? (lines.find((l) => l.id === picking)?.trade ?? null)
            : (lines.find((l) => l.trade)?.trade ?? "roofing")
        }
        onPick={applyPick}
        onClose={() => setPicking(null)}
      />
    </CbSurface>
  );
}
