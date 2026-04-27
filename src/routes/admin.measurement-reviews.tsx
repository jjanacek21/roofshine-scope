import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Ruler, CheckCircle2, AlertCircle, MapPin, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/measurement-reviews")({
  component: AdminMeasurementReviews,
});

type MeasurementRow = {
  id: string;
  property_id: string;
  company_id: string;
  source: string;
  total_area_sqft: number;
  squares: number;
  predominant_pitch: string | null;
  verified_at: string | null;
  created_at: string;
  created_by: string | null;
  property?: { address: string | null } | null;
};

function AdminMeasurementReviews() {
  const [rows, setRows] = useState<MeasurementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "needs_review" | "verified">("needs_review");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("roof_measurements")
      .select(
        "id, property_id, company_id, source, total_area_sqft, squares, predominant_pitch, verified_at, created_at, created_by, property:properties(address)"
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setRows((data as unknown as MeasurementRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const verify = async (id: string) => {
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;
    const { error } = await supabase
      .from("roof_measurements")
      .update({ verified_at: new Date().toISOString(), verified_by: userId })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked verified");
    load();
  };

  const unverify = async (id: string) => {
    const { error } = await supabase
      .from("roof_measurements")
      .update({ verified_at: null, verified_by: null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Re-opened for review");
    load();
  };

  const visible = rows.filter((r) => {
    if (filter === "verified") return !!r.verified_at;
    if (filter === "needs_review") return !r.verified_at;
    return true;
  });

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Ruler className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Measurement Reviews</h1>
          <p className="text-sm text-muted-foreground">
            Every roof measurement run by AI or drawn manually. Open one to inspect, correct in the Mapbox tab,
            then mark it verified — corrections feed the training dataset.
          </p>
        </div>
      </header>

      <div className="flex items-center gap-2">
        {(["needs_review", "verified", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {f === "needs_review" ? "Needs review" : f === "verified" ? "Verified" : "All"}
          </button>
        ))}
        <div className="ml-auto text-xs text-muted-foreground">
          {visible.length} of {rows.length}
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="text-sm font-semibold">Recent measurements</div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {visible.length === 0 && !loading ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nothing in this view yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visible.map((r) => {
              const verified = !!r.verified_at;
              return (
                <div key={r.id} className="grid gap-3 px-5 py-4 md:grid-cols-12 md:items-center">
                  <div className="md:col-span-5">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      {r.property?.address ?? "(no address)"}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5 uppercase tracking-wider">{r.source}</span>
                      <span>{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="md:col-span-3">
                    <div className="text-sm font-mono">
                      {Math.round(Number(r.total_area_sqft || 0)).toLocaleString()} sqft
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {Number(r.squares || 0).toFixed(1)} SQ
                      {r.predominant_pitch ? ` · ${r.predominant_pitch}` : ""}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    {verified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                        <AlertCircle className="h-3 w-3" /> Needs review
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-2 md:col-span-2">
                    <span className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground">
                      {r.id.slice(0, 8)}
                    </span>
                    {verified ? (
                      <button
                        onClick={() => unverify(r.id)}
                        className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                      >
                        Re-open
                      </button>
                    ) : (
                      <button
                        onClick={() => verify(r.id)}
                        className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Verify
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
