import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileUp, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CbButton, CbCard, CbBadge, CbEmptyState, CbLoading } from "@/components/cb/primitives";
import { CB_DOC_BUCKET } from "@/lib/cbPdf";
import {
  cbGapsFrom,
  cbScopeFromJob,
  cbSupTable,
  type CbCarrierLine,
  type CbGapItem,
  type CbMeasureLike,
  type CbScopeItem,
} from "@/lib/cbSupplement";
import { cbMatchCarrierLines, cbParseCarrierEstimate } from "@/lib/cb-supplement.functions";
import type { CbSheet } from "@/lib/cbSheet";

/**
 * The supplement tab.
 *
 * Two lists, in the order a rep works: what the carrier wrote, and what the
 * roof has that they did not write. Nothing on the second list enters the
 * estimate until the rep ticks it — the estimate is a document an adjuster
 * reads, and a wrong line that arrived by default is worse than one that
 * needed a tap.
 */

const MAX_BYTES = 18 * 1024 * 1024;

const money = (v: number | null | undefined) =>
  v == null ? "—" : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/** Reads the picked file without ever putting it through a string per byte. */
async function toBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

type Phase = "idle" | "reading" | "parsing" | "matching";

export function CbSupplementTab({
  jobId,
  workspaceId,
  measure,
  sheet,
  estimateId,
}: {
  jobId: string;
  workspaceId: string | null;
  measure: CbMeasureLike | null;
  sheet: Partial<CbSheet> | null;
  estimateId: string | null;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const scope = useMemo(() => cbScopeFromJob(measure, sheet), [measure, sheet]);

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

  /* Memoised because both lists feed useCallback deps — a fresh array each
     render would rebuild the two write handlers on every keystroke. */
  const lines = useMemo(() => (sup?.lines ?? []) as CbCarrierLine[], [sup]);
  const gaps = useMemo(() => (sup?.gaps ?? []) as CbGapItem[], [sup]);
  const applied = useMemo(() => new Set((sup?.applied ?? []) as string[]), [sup]);

  /* ── upload → parse → match, all in one press ── */
  const onFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_BYTES) {
        toast.error("That PDF is over 18 MB — export a smaller copy and try again.");
        return;
      }
      if (scope.length === 0) {
        toast.error(
          "Measure the roof and fill the takeoff first — there is nothing to compare to.",
        );
        return;
      }

      setPhase("reading");
      try {
        const b64 = await toBase64(file);

        /* Store the document first. If the parse fails afterwards the rep has
           still filed the carrier's estimate against the job, which is the
           half of this that matters to a claim file. */
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

        setPhase("matching");
        const matched = await cbMatchCarrierLines({
          data: {
            lines: parsed.result.lines.map((l) => ({ name: l.name, unit: l.unit, qty: l.qty })),
            scope: scope.map((s) => ({ id: s.id, label: s.label, unit: s.unit, aka: s.aka })),
          },
        });

        /* A failed match is not a failed upload. The carrier's lines are worth
           having on their own, so they are saved either way and the gap list
           simply stays empty rather than being filled with guesses. */
        const nextGaps = matched.ok ? cbGapsFrom(scope, parsed.result.lines, matched.matches) : [];

        await cbSupTable()
          .update({
            status: "parsed",
            carrier: parsed.result.carrier,
            claim_number: parsed.result.claimNumber,
            carrier_total: parsed.result.total,
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
    [jobId, workspaceId, scope, qc],
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
        note: string;
        source: "carrier" | "supplement";
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
          /* Manual keeps these through a rebuild — the estimate builder wipes
             and regenerates everything it derived itself, and a carrier's own
             line is not ours to regenerate. */
          is_manual: true,
        })),
      );
      if (error) {
        toast.error(error.message);
        return false;
      }
      qc.invalidateQueries({ queryKey: ["cb-lead-estimate", jobId] });
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
        note: `From the carrier estimate${sup?.carrier ? ` — ${String(sup.carrier)}` : ""}`,
        source: "carrier" as const,
      })),
    );
    if (ok) {
      await cbSupTable()
        .update({ carrier_imported_at: new Date().toISOString() })
        .eq("id", String(sup?.id));
      qc.invalidateQueries({ queryKey: ["cb-supplement", jobId] });
      toast.success(`${lines.length} carrier lines added to the estimate`);
    }
    setBusy(false);
  }, [addRows, lines, sup, jobId, qc]);

  const addPicked = useCallback(async () => {
    const chosen = gaps.filter((g) => picked[g.id]);
    if (chosen.length === 0) return;
    setBusy(true);
    const ok = await addRows(
      chosen.map((g) => ({
        name: g.label,
        unit: g.unit,
        qty: g.kind === "short" ? Math.max(0, g.qty - (g.carrierQty ?? 0)) : g.qty,
        /* Price is left at zero on purpose. It comes from the company's own
           price book when the estimate is rebuilt; inventing one here would put
           a number on a carrier document that nothing in this app stands
           behind. */
        unit_price: 0,
        code: null,
        note: g.backing,
        source: "supplement" as const,
      })),
    );
    if (ok) {
      await cbSupTable()
        .update({ applied: [...applied, ...chosen.map((g) => g.id)] })
        .eq("id", String(sup?.id));
      qc.invalidateQueries({ queryKey: ["cb-supplement", jobId] });
      setPicked({});
      toast.success(`${chosen.length} added — price them in the estimate`);
    }
    setBusy(false);
  }, [gaps, picked, addRows, applied, sup, jobId, qc]);

  if (isLoading) return <CbLoading label="Opening the supplement…" />;

  const pickedCount = gaps.filter((g) => picked[g.id]).length;
  const working = phase !== "idle";

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
                : "Upload the adjuster's estimate PDF and it is compared against this roof."}
            </p>
            {sup?.carrier_total ? (
              <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
                Their total {money(Number(sup.carrier_total))} · {lines.length} lines
              </p>
            ) : null}
          </div>
          <CbButton
            size="md"
            variant={sup ? "secondary" : "primary"}
            loading={working}
            loadingText={
              phase === "reading"
                ? "Reading…"
                : phase === "parsing"
                  ? "Reading pages…"
                  : "Comparing…"
            }
            onClick={() => fileRef.current?.click()}
          >
            <span className="inline-flex items-center gap-2">
              <FileUp className="h-4 w-4" /> {sup ? "Replace" : "Upload PDF"}
            </span>
          </CbButton>
        </div>

        {scope.length === 0 ? (
          <p
            className="mt-3 flex items-start gap-2 text-[13.5px]"
            style={{ color: "var(--cb-text-muted)" }}
          >
            <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0" />
            There is no measurement or takeoff on this job yet, so nothing can be compared. Run
            those first.
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
              <div>
                <p className="text-[15px] font-semibold" style={{ color: "var(--cb-text)" }}>
                  Not on their estimate
                </p>
                <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
                  Every item below comes from this job&apos;s own measurement or takeoff.
                </p>
              </div>
              <CbButton
                size="md"
                loading={busy}
                disabled={pickedCount === 0}
                onClick={() => void addPicked()}
              >
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Add {pickedCount || ""}
                </span>
              </CbButton>
            </div>

            <div className="mt-3 space-y-2">
              {gaps.map((g) => {
                const already = applied.has(g.id);
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
                          {g.label}
                        </span>
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
                      </span>
                    </span>
                    <span
                      className="whitespace-nowrap text-[13.5px] tabular-nums"
                      style={{ color: "var(--cb-text-muted)" }}
                    >
                      {g.kind === "short"
                        ? `+${Math.round((g.qty - (g.carrierQty ?? 0)) * 10) / 10}`
                        : g.qty}{" "}
                      {g.unit}
                    </span>
                  </label>
                );
              })}
            </div>
          </CbCard>
        ) : (
          <CbEmptyState
            headline="Nothing missing"
            body="Every item this job's measurement and takeoff support already appears on their estimate."
          />
        )
      ) : null}

      {working ? (
        <p
          className="flex items-center gap-2 text-[13.5px]"
          style={{ color: "var(--cb-text-muted)" }}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          {phase === "parsing"
            ? "Reading every page of their estimate — this takes a moment on a long one."
            : phase === "matching"
              ? "Comparing their lines against this roof…"
              : "Reading the file…"}
        </p>
      ) : null}
    </div>
  );
}

export type { CbScopeItem };
