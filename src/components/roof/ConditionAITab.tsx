import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, AlertTriangle } from "lucide-react";

type Damage = {
  type: string;
  severity: "minor" | "moderate" | "severe";
  location_hint?: string;
};
type Analysis = {
  overall_condition?: string;
  roof_material_guess?: string;
  approximate_age_years?: number;
  damages?: Damage[];
  recommended_trades?: string[];
  summary?: string;
};

const SEVERITY_COLORS: Record<string, string> = {
  minor: "var(--brand)",
  moderate: "#f59e0b",
  severe: "#ef4444",
};

export function ConditionAITab({
  propertyId,
  center,
  initial,
}: {
  propertyId: string;
  center: { lng: number; lat: number } | null;
  initial?: Analysis;
}) {
  const [analysis, setAnalysis] = useState<Analysis | null>(initial ?? null);

  const run = useMutation({
    mutationFn: async () => {
      if (!center) throw new Error("Property has no coordinates");
      const { data: s } = await supabase.auth.getSession();
      const accessToken = s.session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");
      const r = await fetch("/api/analyze-roof-condition", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          property_id: propertyId,
          lat: center.lat,
          lng: center.lng,
          photo_urls: [],
        }),
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(txt || "Analysis failed");
      }
      const j = (await r.json()) as { analysis: Analysis };
      return j.analysis;
    },
    onSuccess: (a) => {
      setAnalysis(a);
      toast.success("Condition analysis complete");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Analysis failed"),
  });

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border p-6"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 text-[var(--brand)]" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Claude Vision · Condition Analysis</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Anthropic Claude reviews satellite imagery to assess roof material, age, damage, and
              recommended trades.
            </p>
          </div>
          <button
            onClick={() => run.mutate()}
            disabled={run.isPending || !center}
            className="btn-brand inline-flex h-9 items-center gap-2 rounded-md px-4 text-xs font-semibold disabled:opacity-40"
          >
            {run.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {run.isPending ? "Analyzing…" : "Analyze Roof"}
          </button>
        </div>
      </div>

      {analysis && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Condition" value={analysis.overall_condition ?? "—"} />
            <Stat label="Material" value={analysis.roof_material_guess ?? "—"} />
            <Stat label="Age (yrs)" value={analysis.approximate_age_years?.toString() ?? "—"} />
          </div>
          {analysis.summary && (
            <div className="rounded-md border p-3 text-xs text-foreground" style={{ borderColor: "var(--border)" }}>
              {analysis.summary}
            </div>
          )}
          {analysis.damages && analysis.damages.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Damages ({analysis.damages.length})
              </h4>
              <div className="space-y-1.5">
                {analysis.damages.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-md border p-2 text-xs"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <AlertTriangle
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      style={{ color: SEVERITY_COLORS[d.severity] ?? "var(--brand)" }}
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{d.type}</p>
                      <p className="text-muted-foreground">
                        {d.severity}
                        {d.location_hint ? ` · ${d.location_hint}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {analysis.recommended_trades && analysis.recommended_trades.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {analysis.recommended_trades.map((t) => (
                <span
                  key={t}
                  className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"
                  style={{ borderColor: "var(--border)" }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3" style={{ borderColor: "var(--border)" }}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground capitalize">{value}</p>
    </div>
  );
}
