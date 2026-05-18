import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Check, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type PreviewItem = {
  code: string;
  name: string;
  qty: number;
  unit: string;
  unit_price: number;
  source: "system" | "fl_code" | "ai_photo";
  trade: string;
};

type Preview = {
  system: string | null;
  items: PreviewItem[];
  measurements?: { squares?: number } | null;
};

const SOURCE_LABEL: Record<PreviewItem["source"], string> = {
  system: "System",
  fl_code: "FL Code",
  ai_photo: "Damage",
};

const SOURCE_TONE: Record<PreviewItem["source"], string> = {
  system: "bg-blue-500/15 text-blue-300",
  fl_code: "bg-amber-500/15 text-amber-300",
  ai_photo: "bg-purple-500/15 text-purple-300",
};

async function callBuild(jobId: string, insert: boolean): Promise<Preview> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  const res = await fetch("/api/build-roof-estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ job_id: jobId, insert }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function AISuggestionsPanel({
  jobId,
  activeEstimateId,
}: {
  jobId: string;
  activeEstimateId?: string | null;
  /** Kept for backward compat; no longer used internally. */
  onApprove?: (items: Array<{ code: string; qty: number }>) => Promise<void> | void;
}) {
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data: preview, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["ai-roof-estimate", jobId],
    queryFn: () => callBuild(jobId, false),
  });

  const apply = useMutation({
    mutationFn: () => callBuild(jobId, true),
    onSuccess: (res) => {
      toast.success(`Applied ${(res as unknown as { inserted?: number }).inserted ?? 0} line items`);
      if (activeEstimateId) qc.invalidateQueries({ queryKey: ["estimate-items", activeEstimateId] });
      qc.invalidateQueries({ queryKey: ["ai-roof-estimate", jobId] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to apply suggestions"),
  });

  if (isLoading) return null;
  const items = (preview?.items ?? []).filter((it) => !dismissed.has(it.code));
  if (!preview?.system && items.length === 0) return null;

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "rgba(168,85,247,0.4)", backgroundColor: "rgba(168,85,247,0.05)" }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-semibold">AI Roof Estimate</h3>
          {preview?.system && (
            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold text-blue-300">
              {preview.system.replaceAll("_", " ")}
            </span>
          )}
          {preview?.measurements?.squares ? (
            <span className="font-mono-num text-[10px] text-muted-foreground">
              {preview.measurements.squares} SQ
            </span>
          ) : null}
          <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300">
            {items.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-ghost h-8 rounded-md px-2 text-xs font-semibold disabled:opacity-40"
            title="Recompute from latest photos"
          >
            <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => apply.mutate()}
            disabled={apply.isPending || items.length === 0}
            className="btn-brand h-8 rounded-md px-3 text-xs font-semibold disabled:opacity-40"
          >
            <Check className="mr-1 inline h-3 w-3" /> Apply to estimate
          </button>
        </div>
      </div>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {items.map((it) => (
          <div
            key={it.code}
            className="flex items-center justify-between gap-2 rounded border bg-[var(--bg-card)] p-2 text-xs"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${SOURCE_TONE[it.source]}`}>
                {SOURCE_LABEL[it.source]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  <span className="font-mono-num text-purple-300">{it.code}</span> · {it.name}
                </p>
                <p className="font-mono-num text-[10px] text-muted-foreground">
                  {it.qty} {it.unit} × ${it.unit_price.toFixed(2)} = ${(it.qty * it.unit_price).toFixed(2)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setDismissed((p) => new Set(p).add(it.code))}
              className="text-muted-foreground hover:text-red-400"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
