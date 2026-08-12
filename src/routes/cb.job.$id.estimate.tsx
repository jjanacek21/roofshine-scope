import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
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
  CB_SOURCE_LABEL,
  type CbDraftLine,
  type CbEstimateMode,
  type CbEstimatePercents,
} from "@/lib/cbEstimate";
import { renderCbEstimatePdf } from "@/lib/cbEstimatePdf";

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
  });

  const [mode, setMode] = useState<CbEstimateMode | null>(null);
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
  const [building, setBuilding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  /* first load — mode defaults to whichever the measurement can support */
  useEffect(() => {
    if (!inputs || mode) return;
    const saved = inputs.existing?.estimate.cb_mode as CbEstimateMode | undefined;
    const initial: CbEstimateMode =
      saved ?? (measurementIsComplete(inputs.measurement) ? "line_item" : "per_square");
    setMode(initial);
    setPct(inputs.percents);
    setPps(
      Number(inputs.existing?.estimate.price_per_square) || inputs.defaultPricePerSquare || 0,
    );
    if (inputs.existing?.lines.length) setLines(inputs.existing.lines);
    else void regenerate(initial);
  }, [inputs]); // eslint-disable-line react-hooks/exhaustive-deps

  async function regenerate(next: CbEstimateMode) {
    if (!inputs) return;
    setBuilding(true);
    try {
      const { lines: built, bookName: book } = await buildCbDraft(inputs, next);
      setLines(built);
      setBookName(book);
    } catch {
      toast.error("Couldn't build the estimate — try again");
    } finally {
      setBuilding(false);
    }
  }

  function changeMode(next: CbEstimateMode) {
    cbHaptic();
    setMode(next);
    void regenerate(next);
  }

  const totals = useMemo(() => computeTotals(lines, pct), [lines, pct]);
  const math = useMemo(
    () => perSquareMath(inputs?.measurement ?? null, pps),
    [inputs?.measurement, pps],
  );
  const perSquare = mode === "per_square";

  function editLine(lineId: string, patch: Partial<CbDraftLine>) {
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l)));
  }

  function addLine() {
    cbHaptic();
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
        source: "takeoff",
        basis: "Added by hand",
      },
    ]);
  }

  async function save(): Promise<boolean> {
    if (!inputs || !mode) return false;
    setBusy("save");
    try {
      await saveCbEstimate({
        inputs,
        mode,
        lines: lines.filter((l) => l.name.trim()),
        percents: pct,
        pricePerSquare: pps,
        attachToReport: attach,
      });
      cbHaptic();
      toast.success("Estimate saved");
      return true;
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
            <CbButton size="md" variant="ghost" onClick={() => void regenerate(mode)} disabled={building}>
              {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </CbButton>
          </div>
        </CbStickyHeader>

        <div className="mx-auto max-w-[820px] space-y-5 px-5 pt-5">
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
                  title: "Full line item",
                  body: "Carrier-style build with codes and pricing",
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
                  onChange={(e) => setPps(Number(e.target.value) || 0)}
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
                  {bookName && !perSquare ? (
                    <p className="text-xs opacity-60">Priced from {bookName}</p>
                  ) : null}
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
                      <div className="flex items-start justify-between gap-3">
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
                            {l.basis ? <span className="text-xs opacity-60">{l.basis}</span> : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label="Remove line"
                          className="rounded-lg p-2 opacity-50"
                          onClick={() => setLines((prev) => prev.filter((x) => x.id !== l.id))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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

              <div className="px-5 py-4">
                <CbButton variant="ghost" size="md" onClick={addLine}>
                  <Plus className="mr-1 h-4 w-4" /> Add a line
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
                      onChange={(e) => setPct((p) => ({ ...p, [key]: Number(e.target.value) || 0 }))}
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
                  className="h-5 w-5"
                  checked={attach}
                  onChange={(e) => setAttach(e.target.checked)}
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
    </CbSurface>
  );
}
