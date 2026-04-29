import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Brain, Upload, FileText, MapPin, Trash2, Loader2, Sparkles, CheckCircle2, Camera, ShieldCheck } from "lucide-react";
import { AIMeasurementReviewDialog, type AIRun } from "@/components/admin/AIMeasurementReviewDialog";
import { PhotoDecisionsDrawer, type PhotoDecisionRow, type PhotoSession } from "@/components/admin/PhotoDecisionsDrawer";

export const Route = createFileRoute("/admin/training")({
  component: AdminTrainingCenter,
});

type TrainingExample = {
  id: string;
  address: string;
  lat: number | null;
  lng: number | null;
  source: string;
  ground_truth: Record<string, unknown>;
  solar_response: Record<string, unknown>;
  pdf_storage_path: string | null;
  notes: string | null;
  created_at: string;
};

function AdminTrainingCenter() {
  const [tab, setTab] = useState<"runs" | "pdfs" | "photos">("runs");

  // Photo decisions state
  const [decisions, setDecisions] = useState<PhotoDecisionRow[]>([]);
  const [decMeta, setDecMeta] = useState<Record<string, { address: string | null; company: string | null }>>({});
  const [decLoading, setDecLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<PhotoSession | null>(null);
  const [photoFilter, setPhotoFilter] = useState<"all" | "low" | "high" | "needs">("all");

  // AI runs state
  const [runs, setRuns] = useState<AIRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [activeRun, setActiveRun] = useState<AIRun | null>(null);
  const [filter, setFilter] = useState<"pending" | "all" | "verified" | "corrected">("pending");

  // PDF dataset state
  const [rows, setRows] = useState<TrainingExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [address, setAddress] = useState("");
  const [source, setSource] = useState("roofr");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  const loadRuns = async () => {
    setRunsLoading(true);
    const { data, error } = await supabase
      .from("ai_measurement_runs")
      .select(
        "id, created_at, requested_lat, requested_lng, property_id, job_id, company_id, imagery_quality, total_plan_sqft, total_actual_sqft, predominant_pitch, segment_count, segments, review_status, reviewed_at, notes, property:properties(address), company:companies(name)"
      )
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setRuns((data as unknown as AIRun[]) ?? []);
    setRunsLoading(false);
  };

  const loadDataset = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("training_examples")
      .select("id, address, lat, lng, source, ground_truth, solar_response, pdf_storage_path, notes, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as TrainingExample[]) ?? []);
    setLoading(false);
  };

  const loadDecisions = async () => {
    setDecLoading(true);
    const { data, error } = await supabase
      .from("photo_suggestion_decisions")
      .select("*")
      .order("decided_at", { ascending: false })
      .limit(1000);
    if (error) toast.error(error.message);
    const rows = (data as PhotoDecisionRow[]) ?? [];
    setDecisions(rows);
    // Resolve job → address + company in a second query
    const jobIds = Array.from(new Set(rows.map((d) => d.job_id)));
    if (jobIds.length > 0) {
      const { data: jobs } = await supabase
        .from("jobs")
        .select("id, property_address, company:companies(name), property:properties(address)")
        .in("id", jobIds);
      const meta: Record<string, { address: string | null; company: string | null }> = {};
      for (const j of (jobs as unknown as Array<{ id: string; property_address: string | null; property: { address: string } | null; company: { name: string } | null }> ?? [])) {
        meta[j.id] = {
          address: j.property?.address ?? j.property_address ?? null,
          company: j.company?.name ?? null,
        };
      }
      setDecMeta(meta);
    }
    setDecLoading(false);
  };

  useEffect(() => { loadRuns(); loadDataset(); loadDecisions(); }, []);

  const sessions = useMemo<PhotoSession[]>(() => {
    const byKey = new Map<string, PhotoSession>();
    for (const d of decisions) {
      const day = d.decided_at.slice(0, 10);
      const key = `${d.job_id}::${day}`;
      const meta = decMeta[d.job_id] ?? { address: null, company: null };
      let s = byKey.get(key);
      if (!s) {
        s = {
          job_id: d.job_id,
          date: day,
          decided_at: d.decided_at,
          address: meta.address,
          company_name: meta.company,
          decisions: [],
        };
        byKey.set(key, s);
      }
      s.decisions.push(d);
      if (d.decided_at > s.decided_at) s.decided_at = d.decided_at;
    }
    return Array.from(byKey.values()).sort((a, b) => (a.decided_at < b.decided_at ? 1 : -1));
  }, [decisions, decMeta]);

  const visibleSessions = useMemo(() => {
    return sessions.filter((s) => {
      const picked = s.decisions.filter((d) => d.decision === "picked" || d.decision === "edited").length;
      const rejected = s.decisions.filter((d) => d.decision === "rejected").length;
      const total = picked + rejected;
      const rate = total > 0 ? picked / total : 0;
      const allReviewed = s.decisions.every((d) => d.reviewed_at);
      if (photoFilter === "low") return total > 0 && rate < 0.5;
      if (photoFilter === "high") return total > 0 && rate > 0.8;
      if (photoFilter === "needs") return !allReviewed;
      return true;
    });
  }, [sessions, photoFilter]);


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Choose a PDF first");
    if (!address.trim()) return toast.error("Address is required");
    setUploading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Not authenticated");
      const form = new FormData();
      form.append("file", file);
      form.append("address", address.trim());
      form.append("source", source);
      if (notes.trim()) form.append("notes", notes.trim());
      const res = await fetch("/api/train-from-pdf", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      toast.success("Training example added");
      setFile(null); setAddress(""); setNotes("");
      const fi = document.getElementById("training-pdf-input") as HTMLInputElement | null;
      if (fi) fi.value = "";
      loadDataset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to ingest PDF");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this training example?")) return;
    const { error } = await supabase.from("training_examples").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    loadDataset();
  };

  const visibleRuns = runs.filter((r) => {
    if (filter === "all") return true;
    if (filter === "pending") return r.review_status === "pending";
    return r.review_status === filter;
  });

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Brain className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">AI Training Center</h1>
          <p className="text-sm text-muted-foreground">
            Every AI instant measurement is logged here. Review the highlighted footprint, draw corrections, or upload Roofr/EagleView PDFs to feed the dataset.
          </p>
        </div>
      </header>

      <div className="flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        {[
          { id: "runs" as const, label: "AI Measurements", icon: Sparkles, count: runs.length },
          { id: "pdfs" as const, label: "Ground-truth PDFs", icon: FileText, count: rows.length },
          { id: "photos" as const, label: "Photo Analyses", icon: Camera, count: sessions.length },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label} <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === "runs" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {(["pending", "corrected", "verified", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <div className="ml-auto text-xs text-muted-foreground">{visibleRuns.length} of {runs.length}</div>
          </div>

          <section className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="text-sm font-semibold">AI runs</div>
              {runsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {visibleRuns.length === 0 && !runsLoading ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                No AI measurements in this view yet. Trigger an instant measurement from any job to log one.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {visibleRuns.map((r) => {
                  const planSqft = Number(r.total_plan_sqft || 0);
                  const actualSqft = Number(r.total_actual_sqft || 0);
                  return (
                    <button
                      key={r.id}
                      onClick={() => setActiveRun(r)}
                      className="grid w-full gap-3 px-5 py-4 text-left hover:bg-accent/30 md:grid-cols-12"
                    >
                      <div className="md:col-span-5">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          {r.property?.address ?? `Lat ${Number(r.requested_lat).toFixed(5)}, Lng ${Number(r.requested_lng).toFixed(5)}`}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          {r.company?.name && <span className="rounded bg-muted px-1.5 py-0.5">{r.company.name}</span>}
                          <span>{new Date(r.created_at).toLocaleString()}</span>
                          {r.imagery_quality && <span className="uppercase tracking-wider">{r.imagery_quality}</span>}
                        </div>
                      </div>
                      <div className="md:col-span-3">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">After pitch</div>
                        <div className="font-mono text-sm font-semibold">{Math.round(actualSqft).toLocaleString()} sqft</div>
                        <div className="text-[11px] text-muted-foreground">
                          {(actualSqft / 100).toFixed(1)} SQ{r.predominant_pitch ? ` · ${r.predominant_pitch}` : ""}
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">+15% waste</div>
                        <div className="font-mono text-sm">{Math.round(actualSqft * 1.15).toLocaleString()}</div>
                        <div className="text-[11px] text-muted-foreground">{r.segment_count} facets · {Math.round(planSqft).toLocaleString()} plan</div>
                      </div>
                      <div className="flex items-start justify-end md:col-span-2">
                        {r.review_status === "verified" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Verified
                          </span>
                        )}
                        {r.review_status === "corrected" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-400">
                            <FileText className="h-3 w-3" /> Corrected
                          </span>
                        )}
                        {r.review_status === "pending" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                            Needs review
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "pdfs" && (
        <div className="space-y-6">
          <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Upload className="h-4 w-4 text-primary" /> Add a labeled example
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Property address</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Report source</label>
                <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option value="roofr">Roofr</option>
                  <option value="eagleview">EagleView</option>
                  <option value="hover">Hover</option>
                  <option value="manual">Other / manual</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">PDF report</label>
                <input id="training-pdf-input" type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground" required />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={uploading} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                {uploading ? "Extracting…" : "Ingest PDF"}
              </button>
            </div>
          </form>

          <section className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="text-sm font-semibold">Dataset ({rows.length})</div>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {rows.length === 0 && !loading ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">No training examples yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {rows.map((r) => {
                  const gt = r.ground_truth as { total_sqft?: number; predominant_pitch?: string };
                  const sr = r.solar_response as { total_plan_sqft?: number };
                  const gtTotal = Number(gt?.total_sqft ?? 0);
                  const srTotal = Number(sr?.total_plan_sqft ?? 0);
                  const delta = gtTotal && srTotal ? ((gtTotal - srTotal) / srTotal) * 100 : null;
                  return (
                    <div key={r.id} className="grid gap-3 px-5 py-4 md:grid-cols-12">
                      <div className="md:col-span-4">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />{r.address}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="rounded bg-muted px-1.5 py-0.5 uppercase tracking-wider">{r.source}</span>
                          <span>{new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="md:col-span-3">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Ground truth</div>
                        <div className="text-sm font-mono">{gtTotal ? `${gtTotal.toLocaleString()} sqft` : "—"}</div>
                      </div>
                      <div className="md:col-span-3">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Google Solar</div>
                        <div className="text-sm font-mono">{srTotal ? `${Math.round(srTotal).toLocaleString()} sqft` : "—"}</div>
                        {delta != null && (
                          <div className={`text-xs ${Math.abs(delta) > 10 ? "text-amber-600" : "text-muted-foreground"}`}>
                            {delta > 0 ? "+" : ""}{delta.toFixed(1)}% vs truth
                          </div>
                        )}
                      </div>
                      <div className="flex items-start justify-end gap-2 md:col-span-2">
                        {r.pdf_storage_path && (
                          <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                            <FileText className="h-3 w-3" /> PDF
                          </span>
                        )}
                        <button onClick={() => remove(r.id)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "photos" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {([
              { id: "all", label: "All" },
              { id: "low", label: "Low pick rate (<50%)" },
              { id: "high", label: "High pick rate (>80%)" },
              { id: "needs", label: "Needs review" },
            ] as const).map((f) => (
              <button
                key={f.id}
                onClick={() => setPhotoFilter(f.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  photoFilter === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {f.label}
              </button>
            ))}
            <div className="ml-auto text-xs text-muted-foreground">
              {visibleSessions.length} of {sessions.length}
            </div>
          </div>

          <section className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="text-sm font-semibold">Photo analysis sessions</div>
              {decLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {visibleSessions.length === 0 && !decLoading ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                No photo analyses logged yet. Run a property analysis from any job's Photos tab to populate this view.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {visibleSessions.map((s) => {
                  const picked = s.decisions.filter((d) => d.decision === "picked" || d.decision === "edited");
                  const rejected = s.decisions.filter((d) => d.decision === "rejected");
                  const total = picked.length + rejected.length;
                  const rate = total > 0 ? Math.round((picked.length / total) * 100) : 0;
                  const allReviewed = s.decisions.every((d) => d.reviewed_at);
                  const topCounts = (rows: PhotoDecisionRow[]) => {
                    const m = new Map<string, number>();
                    for (const d of rows) m.set(d.suggested_code, (m.get(d.suggested_code) ?? 0) + 1);
                    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
                  };
                  const topPicked = topCounts(picked);
                  const topRejected = topCounts(rejected);
                  return (
                    <button
                      key={`${s.job_id}-${s.date}`}
                      onClick={() => setActiveSession(s)}
                      className="grid w-full gap-3 px-5 py-4 text-left hover:bg-accent/30 md:grid-cols-12"
                    >
                      <div className="md:col-span-5">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          {s.address ?? "(unknown property)"}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          {s.company_name && <span className="rounded bg-muted px-1.5 py-0.5">{s.company_name}</span>}
                          <span>{new Date(s.decided_at).toLocaleString()}</span>
                          <span>· {s.decisions.length} suggestions</span>
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Pick rate</div>
                        <div className="font-mono text-lg font-semibold">{rate}%</div>
                        <div className="text-[11px] text-muted-foreground">
                          {picked.length} picked · {rejected.length} rejected
                        </div>
                      </div>
                      <div className="md:col-span-3">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Top picked</div>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {topPicked.length === 0 ? (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          ) : (
                            topPicked.map(([code, n]) => (
                              <span key={code} className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                                {code} ×{n}
                              </span>
                            ))
                          )}
                        </div>
                        <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">Top rejected</div>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {topRejected.length === 0 ? (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          ) : (
                            topRejected.map(([code, n]) => (
                              <span key={code} className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] text-red-400">
                                {code} ×{n}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="flex items-start justify-end md:col-span-2">
                        {allReviewed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                            <ShieldCheck className="h-3 w-3" /> Reviewed by admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
                            Pending review
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      <AIMeasurementReviewDialog
        run={activeRun}
        open={!!activeRun}
        onClose={() => setActiveRun(null)}
        onChanged={loadRuns}
      />

      <PhotoDecisionsDrawer
        session={activeSession}
        open={!!activeSession}
        onClose={() => setActiveSession(null)}
        onChanged={loadDecisions}
      />
    </div>
  );
}
