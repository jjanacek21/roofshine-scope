import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileUp, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CbButton, CbCard, CbBadge, CbEmptyState, CbLoading } from "@/components/cb/primitives";
import { CB_DOC_BUCKET } from "@/lib/cbPdf";
import { cbPhotoSignedUrl } from "@/lib/cbPhotos";
import { cbResolveCatalogItems, refreshEstimateTotals } from "@/lib/cbEstimate";
import { resolveCodeRules } from "@/lib/cbCodeRules";
import {
  cbGapsFrom,
  cbScopeFromJob,
  cbSupTable,
  type CbCarrierLine,
  type CbCarrierMeasure,
  type CbGapItem,
  type CbMeasureLike,
  type CbScopeItem,
} from "@/lib/cbSupplement";
import {
  cbMatchCarrierLines,
  cbParseCarrierEstimate,
  cbSupplementPhotoFindings,
} from "@/lib/cb-supplement.functions";
import type { CbSheet } from "@/lib/cbSheet";

/**
 * The supplement tab.
 *
 * Three lists in the order a rep works them: what the carrier wrote, what is
 * missing from it, and what that costs out of the company's own price book.
 *
 * Two things make the missing list defensible rather than a guess. Quantities
 * prefer the carrier's own sketch, so a desk adjuster is checking their own
 * measurement. And prices come from the price book, which is loaded from the
 * same Xactimate data the carrier prices from — so verifying a supplement line
 * means opening their software, not taking our word.
 */

const MAX_BYTES = 18 * 1024 * 1024;
const MAX_PHOTOS = 20;

const money = (v: number | null | undefined) =>
  v == null ? "—" : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/** Reads the picked file without building a string one byte at a time. */
async function toBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

type Phase = "idle" | "reading" | "parsing" | "photos" | "matching" | "pricing";

const PHASE_LABEL: Record<Phase, string> = {
  idle: "",
  reading: "Reading the file…",
  parsing: "Reading every page of their estimate…",
  photos: "Looking through the inspection photos…",
  matching: "Comparing their lines against this roof…",
  pricing: "Pricing what is missing from your price book…",
};

export function CbSupplementTab({
  jobId,
  workspaceId,
  job,
  measure,
  sheet,
  estimateId,
}: {
  jobId: string;
  workspaceId: string | null;
  job: { state?: string | null; county?: string | null; zip?: string | null } | null;
  measure: CbMeasureLike | null;
  sheet: Partial<CbSheet> | null;
  estimateId: string | null;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const { data: sup, isLoading } = useQuery({
    queryKey: ["cb-supplement", jobId],
    queryFn: async () => {
      const { data, error } = await cbSupTable()
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as Record<string, unknown> | null;
    },
  });

  const lines = useMemo(() => (sup?.lines ?? []) as CbCarrierLine[], [sup]);
  const gaps = useMemo(() => (sup?.gaps ?? []) as CbGapItem[], [sup]);
  const applied = useMemo(() => new Set((sup?.applied ?? []) as string[]), [sup]);
  const carrierMeasure = useMemo(() => (sup?.carrier_measure ?? {}) as CbCarrierMeasure, [sup]);

  /** Items the local building code requires, with the citation attached. */
  const codeScope = useCallback(
    async (squares: number, perimeter: number): Promise<CbScopeItem[]> => {
      if (!job?.state) return [];
      const { set, items } = await resolveCodeRules({
        state: job.state ?? null,
        county: job.county ?? null,
      });
      if (!set) return [];
      return items
        .map((rule): CbScopeItem | null => {
          const factor = Number(rule.qty_factor) || 1;
          const mode = (rule.qty_mode ?? "fixed").toLowerCase();
          let qty = factor;
          if (mode.includes("square") || mode.includes("sq")) qty = factor * squares;
          else if (mode.includes("perimeter") || mode.includes("lf")) qty = factor * perimeter;
          if (!(qty > 0)) return null;
          const label = rule.item_name ?? "Code-required item";
          return {
            id: `code_${rule.id}`,
            label,
            unit: (rule.unit ?? "EA").toUpperCase(),
            qty: Math.round(qty * 10) / 10,
            backing: `${set.name} — ${rule.code_reference}${rule.note ? ` · ${rule.note}` : ""}`,
            aka: label.toLowerCase(),
            origin: "code",
            codeReference: rule.code_reference,
          };
        })
        .filter((x): x is CbScopeItem => x !== null);
    },
    [job],
  );

  /* ── upload → parse → photos → match → price ── */
  const onFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_BYTES) {
        toast.error("That PDF is over 18 MB — export a smaller copy and try again.");
        return;
      }

      setPhase("reading");
      try {
        const b64 = await toBase64(file);

        /* Store the document first. If everything after this fails, the rep has
           still filed the carrier's estimate against the job, which is the half
           that matters to a claim file. */
        const path = `${workspaceId ?? "ws"}/${jobId}/carrier-${Date.now()}.pdf`;
        await supabase.storage
          .from(CB_DOC_BUCKET)
          .upload(path, file, { upsert: true, contentType: "application/pdf" });

        const { data: row, error: insErr } = await cbSupTable()
          .insert({
            job_id: jobId,
            pdf_path: path,
            file_name: file.name.slice(0, 160),
            status: "parsing",
          })
          .select("id")
          .single();
        if (insErr) throw new Error(insErr.message);
        const supId = (row as { id: string }).id;
        qc.invalidateQueries({ queryKey: ["cb-supplement", jobId] });

        setPhase("parsing");
        const parsed = await cbParseCarrierEstimate({ data: { pdfBase64: b64 } });
        if (!parsed.ok) {
          await cbSupTable()
            .update({ status: "failed", parse_error: parsed.reason })
            .eq("id", supId);
          qc.invalidateQueries({ queryKey: ["cb-supplement", jobId] });
          toast.error(
            parsed.reason === "no_line_items_found"
              ? "No line items found in that PDF. Is it the estimate, or a cover letter?"
              : "Could not read that estimate. Try again in a moment.",
          );
          return;
        }

        /* Their sketch wins on quantity from here on. */
        const base = cbScopeFromJob(measure, sheet, parsed.result.measure);
        const squares = Number(parsed.result.measure.total_squares ?? measure?.total_squares ?? 0);
        const perimeter =
          Number(parsed.result.measure.eave_lf ?? measure?.eave_lf ?? 0) +
          Number(parsed.result.measure.rake_lf ?? measure?.rake_lf ?? 0);

        /* ── photos ── */
        setPhase("photos");
        const photoScope: CbScopeItem[] = [];
        try {
          const { data: photoRows } = await supabase
            .from("cb_photos")
            .select("storage_path")
            .eq("job_id", jobId)
            .order("sort_order", { ascending: true })
            .limit(MAX_PHOTOS);
          const urls = (
            await Promise.all(
              (photoRows ?? []).map((p) =>
                cbPhotoSignedUrl((p as { storage_path: string }).storage_path),
              ),
            )
          ).filter((u): u is string => Boolean(u));

          if (urls.length) {
            const seen = await cbSupplementPhotoFindings({
              data: {
                images: urls,
                known: [...base.map((b) => b.label), ...parsed.result.lines.map((l) => l.name)],
              },
            });
            if (seen.ok) {
              for (const [i, f] of seen.findings.entries()) {
                photoScope.push({
                  id: `photo_${i}`,
                  label: f.label,
                  unit: f.unit,
                  /* No visible count means the rep sets it. Carrying 1 forward
                     would put a fabricated quantity on a carrier document. */
                  qty: f.qty ?? 1,
                  backing: `Photo ${f.photo + 1}: ${f.seen}`,
                  aka: f.label.toLowerCase(),
                  origin: "photo",
                });
              }
            }
          }
        } catch {
          /* Vision is the optional half. Losing it must not lose the estimate. */
        }

        const scope = [...base, ...photoScope, ...(await codeScope(squares, perimeter))];

        setPhase("matching");
        const matched = await cbMatchCarrierLines({
          data: {
            lines: parsed.result.lines.map((l) => ({ name: l.name, unit: l.unit, qty: l.qty })),
            scope: scope.map((s) => ({ id: s.id, label: s.label, unit: s.unit, aka: s.aka })),
          },
        });

        /* A failed match is not a failed upload. Their lines are worth having on
           their own, so they save either way and the missing list stays empty
           rather than filling with guesses. */
        let nextGaps = matched.ok ? cbGapsFrom(scope, parsed.result.lines, matched.matches) : [];

        /* ── price what is missing ── */
        if (nextGaps.length) {
          setPhase("pricing");
          try {
            const { data: ws } = await supabase
              .from("cb_workspaces")
              .select("gc_company_id")
              .eq("id", workspaceId ?? "")
              .maybeSingle();
            const companyId =
              (ws as { gc_company_id: string | null } | null)?.gc_company_id ?? null;

            const hits = await cbResolveCatalogItems(
              nextGaps.map((g) => ({ key: g.id, label: g.label, unit: g.unit })),
              companyId,
              { zip: job?.zip ?? null, state: job?.state ?? null },
            );
            nextGaps = nextGaps.map((g) => {
              const hit = hits[g.id];
              return hit
                ? {
                    ...g,
                    priced: {
                      lineItemId: hit.line_item_id,
                      code: hit.code,
                      name: hit.name,
                      unit: hit.unit,
                      unitPrice: hit.unit_price,
                    },
                  }
                : g;
            });
          } catch {
            /* Unpriced items still list; the rep prices them in the builder. */
          }
        }

        await cbSupTable()
          .update({
            status: "parsed",
            carrier: parsed.result.carrier,
            claim_number: parsed.result.claimNumber,
            carrier_total: parsed.result.total,
            carrier_measure: parsed.result.measure,
            lines: parsed.result.lines,
            gaps: nextGaps,
            parse_error: matched.ok ? null : matched.reason,
          })
          .eq("id", supId);

        qc.invalidateQueries({ queryKey: ["cb-supplement", jobId] });
        setPicked({});
        toast.success(
          `${parsed.result.lines.length} carrier lines read` +
            (matched.ok ? ` · ${nextGaps.length} not on their estimate` : ""),
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setPhase("idle");
      }
    },
    [jobId, workspaceId, measure, sheet, job, codeScope, qc],
  );

  /* ── write into the estimate ── */
  const addRows = useCallback(
    async (
      rows: {
        name: string;
        unit: string;
        qty: number;
        unit_price: number;
        code: string | null;
        line_item_id: string | null;
        note: string;
        source: "carrier" | "supplement" | "code";
      }[],
    ) => {
      if (!estimateId) {
        toast.error("Build the estimate first — then these can be added to it.");
        return false;
      }
      const { data: last } = await supabase
        .from("estimate_line_items")
        .select("sort_order")
        .eq("estimate_id", estimateId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const base = Number((last as { sort_order?: number } | null)?.sort_order ?? 0) + 1;

      const { error } = await supabase.from("estimate_line_items").insert(
        rows.map((r, i) => ({
          estimate_id: estimateId,
          line_item_id: r.line_item_id,
          trade: "roofing" as never,
          code: r.code,
          name: r.name,
          unit: r.unit,
          qty: r.qty,
          unit_price: r.unit_price,
          total: Math.round(r.qty * r.unit_price * 100) / 100,
          sort_order: base + i,
          source: r.source,
          note: r.note,
          /* Manual keeps these through a rebuild. The estimate builder wipes
             and regenerates everything it derived itself, and a carrier's own
             line is not ours to regenerate. */
          is_manual: true,
        })),
      );
      if (error) {
        toast.error(error.message);
        return false;
      }
      /* These lines went straight into the estimate, so its stored totals — and
         the carrier document that reads them back — are now behind. */
      await refreshEstimateTotals(estimateId);
      qc.invalidateQueries({ queryKey: ["cb-lead-estimate", jobId] });
      qc.invalidateQueries({ queryKey: ["cb-estimate-inputs", jobId] });
      return true;
    },
    [estimateId, jobId, qc],
  );

  const importCarrier = useCallback(async () => {
    setBusy(true);
    const ok = await addRows(
      lines.map((l) => ({
        name: l.name,
        unit: l.unit || "EA",
        qty: l.qty,
        unit_price: l.unit_price ?? 0,
        code: l.code,
        line_item_id: null,
        note: `From the carrier estimate${sup?.carrier ? ` — ${String(sup.carrier)}` : ""}`,
        source: "carrier" as const,
      })),
    );
    if (ok) {
      await cbSupTable()
        .update({ carrier_imported_at: new Date().toISOString() })
        .eq("id", String(sup?.id));
      qc.invalidateQueries({ queryKey: ["cb-supplement", jobId] });
      toast.success(`${lines.length} carrier lines added at their pricing`);
    }
    setBusy(false);
  }, [addRows, lines, sup, jobId, qc]);

  const addPicked = useCallback(async () => {
    const chosen = gaps.filter((g) => picked[g.id]);
    if (chosen.length === 0) return;
    setBusy(true);
    const ok = await addRows(
      chosen.map((g) => ({
        name: g.priced?.name ?? g.label,
        unit: g.priced?.unit ?? g.unit,
        qty: g.kind === "short" ? Math.max(0, g.qty - (g.carrierQty ?? 0)) : g.qty,
        unit_price: g.priced?.unitPrice ?? 0,
        code: g.priced?.code ?? null,
        line_item_id: g.priced?.lineItemId ?? null,
        note: g.backing,
        source: g.origin === "code" ? ("code" as const) : ("supplement" as const),
      })),
    );
    if (ok) {
      await cbSupTable()
        .update({ applied: [...applied, ...chosen.map((g) => g.id)] })
        .eq("id", String(sup?.id));
      qc.invalidateQueries({ queryKey: ["cb-supplement", jobId] });
      setPicked({});
      toast.success(`${chosen.length} added to the estimate`);
    }
    setBusy(false);
  }, [gaps, picked, addRows, applied, sup, jobId, qc]);

  if (isLoading) return <CbLoading label="Opening the supplement…" />;

  const chosen = gaps.filter((g) => picked[g.id]);
  const chosenTotal = chosen.reduce((sum, g) => {
    const qty = g.kind === "short" ? Math.max(0, g.qty - (g.carrierQty ?? 0)) : g.qty;
    return sum + qty * (g.priced?.unitPrice ?? 0);
  }, 0);
  const working = phase !== "idle";
  const sketch = Object.keys(carrierMeasure).length > 0;

  const ORIGIN_LABEL: Record<CbScopeItem["origin"], string> = {
    carrier_sketch: "Their sketch",
    measurement: "Measurement",
    takeoff: "Takeoff",
    photo: "Photo",
    code: "Code",
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onFile(f);
        }}
      />

      {/* ── upload ── */}
      <CbCard className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold" style={{ color: "var(--cb-text)" }}>
              Carrier estimate
            </p>
            <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
              {sup?.file_name
                ? `${String(sup.file_name)}${sup.carrier ? ` · ${String(sup.carrier)}` : ""}`
                : "Upload the adjuster's estimate PDF. Their line items, their measurements, and what they left off."}
            </p>
            {sup?.carrier_total ? (
              <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
                Their total {money(Number(sup.carrier_total))} · {lines.length} lines
                {sketch && carrierMeasure.total_squares
                  ? ` · their sketch: ${carrierMeasure.total_squares} SQ`
                  : ""}
              </p>
            ) : null}
          </div>
          <CbButton
            size="md"
            variant={sup ? "secondary" : "primary"}
            loading={working}
            loadingText={PHASE_LABEL[phase] || "Working…"}
            onClick={() => fileRef.current?.click()}
          >
            <span className="inline-flex items-center gap-2">
              <FileUp className="h-4 w-4" /> {sup ? "Replace" : "Upload PDF"}
            </span>
          </CbButton>
        </div>

        {sup?.status === "parsed" && !sketch ? (
          <p
            className="mt-3 flex items-start gap-2 text-[13.5px]"
            style={{ color: "var(--cb-text-muted)" }}
          >
            <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0" />
            Their estimate printed no sketch measurements, so quantities below come from your own
            measurement.
          </p>
        ) : null}

        {sup?.status === "failed" ? (
          <p className="mt-3 text-[13.5px]" style={{ color: "#b91c1c" }}>
            That estimate could not be read ({String(sup.parse_error ?? "unknown")}). The PDF is
            still filed against this job.
          </p>
        ) : null}
      </CbCard>

      {/* ── their lines ── */}
      {lines.length ? (
        <CbCard className="p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] font-semibold" style={{ color: "var(--cb-text)" }}>
              What they wrote
            </p>
            <CbButton
              size="md"
              variant="secondary"
              loading={busy}
              disabled={Boolean(sup?.carrier_imported_at)}
              onClick={() => void importCarrier()}
            >
              {sup?.carrier_imported_at ? "Added" : "Add to estimate"}
            </CbButton>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[13.5px]" style={{ color: "var(--cb-text)" }}>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={`${l.name}-${i}`} style={{ borderTop: "1px solid var(--cb-hairline)" }}>
                    <td className="py-2 pr-3">{l.name}</td>
                    <td
                      className="whitespace-nowrap py-2 pr-3 text-right tabular-nums"
                      style={{ color: "var(--cb-text-muted)" }}
                    >
                      {l.qty} {l.unit}
                    </td>
                    <td className="whitespace-nowrap py-2 text-right tabular-nums">
                      {money(l.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CbCard>
      ) : null}

      {/* ── the gap ── */}
      {sup?.status === "parsed" ? (
        gaps.length ? (
          <CbCard className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold" style={{ color: "var(--cb-text)" }}>
                  Not on their estimate
                </p>
                <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
                  Priced from your price book, quantities off their sketch where they printed one.
                </p>
              </div>
              <CbButton
                size="md"
                loading={busy}
                disabled={chosen.length === 0}
                onClick={() => void addPicked()}
              >
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add {chosen.length ? `${chosen.length} · ${money(chosenTotal)}` : ""}
                </span>
              </CbButton>
            </div>

            <div className="mt-3 space-y-2">
              {gaps.map((g) => {
                const already = applied.has(g.id);
                const qty = g.kind === "short" ? Math.max(0, g.qty - (g.carrierQty ?? 0)) : g.qty;
                return (
                  <label
                    key={g.id}
                    className="flex cursor-pointer items-start gap-3 rounded-[12px] p-2"
                    style={{
                      border: "1px solid var(--cb-hairline)",
                      opacity: already ? 0.55 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      disabled={already}
                      checked={Boolean(picked[g.id])}
                      onChange={(e) => setPicked((p) => ({ ...p, [g.id]: e.target.checked }))}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span
                          className="text-[14px] font-medium"
                          style={{ color: "var(--cb-text)" }}
                        >
                          {g.priced?.name ?? g.label}
                        </span>
                        {g.priced?.code ? (
                          <span
                            className="font-mono text-[11.5px]"
                            style={{ color: "var(--cb-text-muted)" }}
                          >
                            {g.priced.code}
                          </span>
                        ) : null}
                        <CbBadge tone={g.origin === "code" ? "accent" : "neutral"}>
                          {ORIGIN_LABEL[g.origin]}
                        </CbBadge>
                        <CbBadge tone={g.kind === "missing" ? "danger" : "warning"}>
                          {g.kind === "missing" ? "Not written" : "Short"}
                        </CbBadge>
                        {already ? <CbBadge tone="success">Added</CbBadge> : null}
                      </span>
                      <span
                        className="mt-1 block text-[13px]"
                        style={{ color: "var(--cb-text-muted)" }}
                      >
                        {g.kind === "short"
                          ? `They allowed ${g.carrierQty} ${g.unit}${g.carrierName ? ` (${g.carrierName})` : ""} · ${g.backing}`
                          : g.backing}
                        {g.priced ? null : " · no price book match — price it in the builder"}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-right">
                      <span
                        className="block text-[13.5px] tabular-nums"
                        style={{ color: "var(--cb-text-muted)" }}
                      >
                        {Math.round(qty * 10) / 10} {g.priced?.unit ?? g.unit}
                      </span>
                      {g.priced ? (
                        <span
                          className="block text-[13.5px] font-medium tabular-nums"
                          style={{ color: "var(--cb-text)" }}
                        >
                          {money(qty * g.priced.unitPrice)}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </CbCard>
        ) : (
          <CbEmptyState
            headline="Nothing missing"
            body="Every item this job's measurement, takeoff, photos and local code support already appears on their estimate."
          />
        )
      ) : null}

      {working ? (
        <p
          className="flex items-center gap-2 text-[13.5px]"
          style={{ color: "var(--cb-text-muted)" }}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          {PHASE_LABEL[phase]}
        </p>
      ) : null}
    </div>
  );
}
