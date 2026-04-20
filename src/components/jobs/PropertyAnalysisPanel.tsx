import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Loader2, Home, ChevronRight, CheckCircle2 } from "lucide-react";

type ConsolidatedItem = {
  suggested_code?: string;
  description: string;
  qty: number;
  unit: string;
  confidence: "low" | "medium" | "high";
  product_details?: { material?: string; brand_guess?: string; color?: string };
  condition_notes?: string;
  source_photo_indices?: number[];
  source_photo_ids?: string[];
  unit_price?: number | null;
  catalog_name?: string | null;
  catalog_trade?: string | null;
};

type Analysis = {
  property_summary?: {
    roof?: string;
    siding?: string;
    interior?: string;
    exterior?: string;
    condition_score?: number;
    age_estimate?: string;
    notable_concerns?: string[];
  };
  surfaces?: Array<{
    name: string;
    material?: string;
    area_estimate_sf?: number;
    squares?: number;
    lf?: number;
    condition_score?: number;
    defects?: string[];
  }>;
  consolidated_line_items?: ConsolidatedItem[];
  analyzed_photo_ids?: string[];
};

type AnalysisRow = {
  id: string;
  created_at: string;
  photo_count: number;
  analysis: Analysis;
};

function PhotoThumb({ photoId }: { photoId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: photo } = await supabase
        .from("job_photos")
        .select("storage_path")
        .eq("id", photoId)
        .maybeSingle();
      if (!photo) return;
      const base = photo.storage_path.replace(/\.[^.]+$/, "");
      const { data: thumb } = await supabase.storage
        .from("roof-photos")
        .createSignedUrl(`${base}_thumb.jpg`, 3600);
      if (thumb?.signedUrl && !cancelled) {
        setUrl(thumb.signedUrl);
        return;
      }
      const { data: full } = await supabase.storage
        .from("roof-photos")
        .createSignedUrl(photo.storage_path, 3600);
      if (full?.signedUrl && !cancelled) setUrl(full.signedUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [photoId]);

  return (
    <div
      className="h-10 w-10 shrink-0 overflow-hidden rounded border bg-[var(--surface)]"
      style={{ borderColor: "var(--border)" }}
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : null}
    </div>
  );
}

const confidenceClass: Record<string, string> = {
  high: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

export function PropertyAnalysisPanel({
  jobId,
  photoCount,
}: {
  jobId: string;
  photoCount: number;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data: latest } = useQuery({
    queryKey: ["job-property-analysis", jobId],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_property_analyses")
        .select("id, created_at, photo_count, analysis")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as AnalysisRow | null;
    },
  });

  const items = useMemo(() => latest?.analysis?.consolidated_line_items ?? [], [latest]);

  // Default-select all rows when a new analysis loads
  useEffect(() => {
    if (items.length > 0) {
      setSelected(new Set(items.map((_, i) => i)));
    }
  }, [items]);

  const analyze = useMutation({
    mutationFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error("Not authenticated");
      const r = await fetch("/api/analyze-property", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ job_id: jobId }),
      });
      if (!r.ok) {
        let msg = `Analysis failed (${r.status})`;
        try {
          const j = await r.json();
          if (j?.error) msg = j.error;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Property analyzed");
      qc.invalidateQueries({ queryKey: ["job-property-analysis", jobId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Analysis failed"),
  });

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const addAll = async () => {
    const chosen = items.filter((_, i) => selected.has(i));
    if (chosen.length === 0) {
      toast.info("Select at least one item");
      return;
    }

    // Load job (for company_id, primary_trade, default pcts via company)
    const { data: job } = await supabase
      .from("jobs")
      .select("id, company_id, primary_trade")
      .eq("id", jobId)
      .maybeSingle();
    if (!job) {
      toast.error("Job not found");
      return;
    }

    // Find or create active estimate (latest by created_at)
    const { data: existing } = await supabase
      .from("estimates")
      .select("id")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let estimateId = existing?.id ?? null;
    if (!estimateId) {
      const { data: company } = await supabase
        .from("companies")
        .select("default_markup_pct, default_overhead_pct, default_profit_pct, default_tax_rate")
        .eq("id", job.company_id)
        .maybeSingle();
      const { data: created, error: cErr } = await supabase
        .from("estimates")
        .insert({
          job_id: jobId,
          company_id: job.company_id,
          name: "Original",
          tier: "original",
          markup_pct: Number(company?.default_markup_pct ?? 10),
          overhead_pct: Number(company?.default_overhead_pct ?? 10),
          profit_pct: Number(company?.default_profit_pct ?? 10),
          tax_pct: Number(company?.default_tax_rate ?? 0),
        })
        .select("id")
        .single();
      if (cErr || !created) {
        toast.error("Could not create estimate");
        return;
      }
      estimateId = created.id;
    }

    // Find current max sort_order
    const { data: lastRow } = await supabase
      .from("estimate_line_items")
      .select("sort_order")
      .eq("estimate_id", estimateId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const startOrder = (lastRow?.sort_order ?? -1) + 1;

    const fallbackTrade = (job.primary_trade ?? "roofing") as
      | "roofing"
      | "exterior"
      | "windows"
      | "interior"
      | "hvac"
      | "plumbing"
      | "electrical"
      | "mitigation";

    const rows = chosen.map((it, idx) => {
      const matched = !!it.catalog_name;
      const unit_price = Number(it.unit_price ?? 0);
      const qty = Number(it.qty ?? 0);
      return {
        estimate_id: estimateId!,
        line_item_id: null,
        code: matched ? it.suggested_code ?? null : null,
        name: matched ? it.catalog_name! : it.description,
        trade: ((it.catalog_trade as typeof fallbackTrade) ?? fallbackTrade),
        unit: it.unit || "EA",
        qty,
        unit_price,
        total: qty * unit_price,
        source: "ai_property",
        sort_order: startOrder + idx,
      };
    });

    const { error: insErr } = await supabase.from("estimate_line_items").insert(rows);
    if (insErr) {
      toast.error("Could not add items", { description: insErr.message });
      return;
    }

    const customCount = rows.filter((r) => !r.code).length;
    const matchedCount = rows.length - customCount;
    qc.invalidateQueries({ queryKey: ["estimate-items", estimateId] });
    qc.invalidateQueries({ queryKey: ["estimates", jobId] });
    toast.success(`Added ${rows.length} item${rows.length === 1 ? "" : "s"}`, {
      description:
        customCount > 0
          ? `${matchedCount} matched · ${customCount} inserted as custom (no catalog match)`
          : undefined,
    });
    navigate({ to: "/jobs/$id/estimate", params: { id: jobId }, search: {} });
  };

  const summary = latest?.analysis?.property_summary;
  const hasAnalysis = !!latest && items.length > 0;
  const isStale = latest && latest.photo_count !== photoCount;

  return (
    <div
      className="rounded-xl border"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
    >
      <div
        className="flex items-center justify-between gap-3 border-b p-4"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">Property Analysis</h2>
          {latest && (
            <span className="text-[11px] text-muted-foreground">
              · {latest.photo_count} photo{latest.photo_count === 1 ? "" : "s"} analyzed
            </span>
          )}
          {isStale && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-400">
              {photoCount - latest.photo_count} new — re-run
            </span>
          )}
        </div>
        <button
          onClick={() => analyze.mutate()}
          disabled={analyze.isPending || photoCount === 0}
          className="btn-brand inline-flex h-9 items-center gap-2 rounded-md px-4 text-xs font-semibold disabled:opacity-40"
        >
          {analyze.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {hasAnalysis ? "Re-analyze property" : `Analyze property (${photoCount} photos)`}
        </button>
      </div>

      {!hasAnalysis ? (
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {photoCount === 0
              ? "Upload photos, then run a single property-wide AI analysis."
              : "Click the button above to analyze all photos as one property and produce a consolidated, deduplicated estimate."}
          </p>
        </div>
      ) : (
        <div className="space-y-4 p-4">
          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {summary.roof && <SummaryCard label="Roof" body={summary.roof} />}
              {summary.siding && <SummaryCard label="Siding" body={summary.siding} />}
              {summary.exterior && <SummaryCard label="Exterior" body={summary.exterior} />}
              {summary.interior && <SummaryCard label="Interior" body={summary.interior} />}
            </div>
          )}

          {summary?.notable_concerns && summary.notable_concerns.length > 0 && (
            <div
              className="rounded-md border p-3 text-xs"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
            >
              <div className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
                Notable concerns
              </div>
              <ul className="ml-4 list-disc space-y-0.5 text-foreground">
                {summary.notable_concerns.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Consolidated line items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Suggested line items ({items.length})
              </h3>
              <button
                onClick={addAll}
                disabled={selected.size === 0}
                className="btn-brand inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold disabled:opacity-40"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Add {selected.size} to estimate
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            <div
              className="overflow-hidden rounded-md border"
              style={{ borderColor: "var(--border)" }}
            >
              {items.map((it, i) => {
                const isSel = selected.has(i);
                const total = (it.unit_price ?? 0) * (it.qty ?? 0);
                return (
                  <label
                    key={i}
                    className="flex cursor-pointer items-start gap-3 border-b p-3 last:border-b-0 hover:bg-[var(--surface-hover)]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggle(i)}
                      className="mt-1 h-4 w-4"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        {it.suggested_code && (
                          <span className="font-mono-num text-xs font-semibold text-foreground">
                            {it.suggested_code}
                          </span>
                        )}
                        <span className="text-sm text-foreground">
                          {it.catalog_name ?? it.description}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            confidenceClass[it.confidence] ?? confidenceClass.low
                          }`}
                        >
                          {it.confidence}
                        </span>
                      </div>
                      {(it.product_details?.material ||
                        it.product_details?.brand_guess ||
                        it.product_details?.color) && (
                        <p className="text-[11px] text-muted-foreground">
                          {[
                            it.product_details.material,
                            it.product_details.brand_guess,
                            it.product_details.color,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                      {it.condition_notes && (
                        <p className="text-[11px] italic text-muted-foreground">
                          {it.condition_notes}
                        </p>
                      )}
                      {it.source_photo_ids && it.source_photo_ids.length > 0 && (
                        <div className="flex items-center gap-1 pt-1">
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            From
                          </span>
                          {it.source_photo_ids.slice(0, 6).map((pid) => (
                            <PhotoThumb key={pid} photoId={pid} />
                          ))}
                          {it.source_photo_ids.length > 6 && (
                            <span className="text-[11px] text-muted-foreground">
                              +{it.source_photo_ids.length - 6}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-mono-num font-semibold">
                        {it.qty} {it.unit}
                      </div>
                      {it.unit_price != null ? (
                        <div className="font-mono-num text-muted-foreground">
                          ${it.unit_price.toFixed(2)}/{it.unit}
                        </div>
                      ) : (
                        <div className="text-[10px] italic text-muted-foreground">no price</div>
                      )}
                      {it.unit_price != null && (
                        <div className="font-mono-num pt-1 font-semibold text-foreground">
                          ${total.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, body }: { label: string; body: string }) {
  return (
    <div
      className="rounded-md border p-3"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xs text-foreground">{body}</div>
    </div>
  );
}
