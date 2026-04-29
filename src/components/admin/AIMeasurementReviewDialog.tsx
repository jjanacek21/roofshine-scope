import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AIMeasurementMap, type AISegment } from "./AIMeasurementMap";
import { Loader2, Upload, ExternalLink, CheckCircle2, FileText } from "lucide-react";
import { Link } from "@tanstack/react-router";

export type AIRun = {
  id: string;
  created_at: string;
  requested_lat: number;
  requested_lng: number;
  property_id: string | null;
  job_id: string | null;
  company_id: string | null;
  imagery_quality: string | null;
  total_plan_sqft: number;
  total_actual_sqft: number;
  predominant_pitch: string | null;
  segment_count: number;
  segments: AISegment[];
  review_status: string;
  reviewed_at: string | null;
  notes: string | null;
  property?: { address: string | null } | null;
  company?: { name: string | null } | null;
};

const WASTE_OPTIONS = [0, 10, 15, 20];

export function AIMeasurementReviewDialog({
  run,
  open,
  onClose,
  onChanged,
}: {
  run: AIRun | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [source, setSource] = useState("roofr");

  if (!run) return null;

  const actualSqft = Number(run.total_actual_sqft || 0);
  const planSqft = Number(run.total_plan_sqft || 0);

  const markVerified = async () => {
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;
    const { error } = await supabase
      .from("ai_measurement_runs")
      .update({
        review_status: "verified",
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
      })
      .eq("id", run.id);
    if (error) return toast.error(error.message);
    toast.success("Marked verified");
    onChanged();
    onClose();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!run.property?.address && !run.requested_lat) {
      toast.error("No address available for this run");
      return;
    }
    setUploading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const form = new FormData();
      form.append("file", file);
      form.append(
        "address",
        run.property?.address ?? `Lat ${run.requested_lat}, Lng ${run.requested_lng}`,
      );
      form.append("source", source);
      form.append("ai_run_id", run.id);

      const res = await fetch("/api/train-from-pdf", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      toast.success("Ground-truth PDF paired with this AI run");
      onChanged();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>AI measurement review</DialogTitle>
          <DialogDescription>
            {run.property?.address ?? `Lat ${Number(run.requested_lat).toFixed(5)}, Lng ${Number(run.requested_lng).toFixed(5)}`}
            {run.company?.name ? ` · ${run.company.name}` : ""}
          </DialogDescription>
        </DialogHeader>

        <AIMeasurementMap
          lat={Number(run.requested_lat)}
          lng={Number(run.requested_lng)}
          segments={run.segments ?? []}
          height={340}
        />

        <div className="grid gap-3 md:grid-cols-3">
          <Stat label="Plan area" value={`${Math.round(planSqft).toLocaleString()} sqft`} sub={`${(planSqft / 100).toFixed(1)} SQ`} />
          <Stat
            label="After pitch factor"
            value={`${Math.round(actualSqft).toLocaleString()} sqft`}
            sub={`${(actualSqft / 100).toFixed(1)} SQ${run.predominant_pitch ? ` · ${run.predominant_pitch}` : ""}`}
          />
          <Stat label="Facets" value={String(run.segment_count)} sub={run.imagery_quality ?? ""} />
        </div>

        <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Waste-adjusted totals
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {WASTE_OPTIONS.map((w) => {
              const sqft = actualSqft * (1 + w / 100);
              return (
                <div key={w} className="rounded-md bg-muted/40 p-2">
                  <div className="text-[11px] text-muted-foreground">+{w}% waste</div>
                  <div className="text-sm font-mono font-semibold">{Math.round(sqft).toLocaleString()}</div>
                  <div className="text-[11px] text-muted-foreground">{(sqft / 100).toFixed(1)} SQ</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-semibold">Improve the dataset</div>
          <div className="grid gap-2 md:grid-cols-2">
            {run.job_id && (
              <Link
                to="/jobs/$id/measure"
                params={{ id: run.job_id }}
                className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent"
                style={{ borderColor: "var(--border)" }}
                onClick={onClose}
              >
                <ExternalLink className="h-4 w-4" /> Open in measurement tool to draw correct footprint
              </Link>
            )}
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent" style={{ borderColor: "var(--border)" }}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload Roofr / EagleView PDF
              <input type="file" accept="application/pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Report source:</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="rounded border bg-background px-2 py-1"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="roofr">Roofr</option>
              <option value="eagleview">EagleView</option>
              <option value="hover">Hover</option>
              <option value="manual">Other</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--border)" }}>
          <div className="text-xs text-muted-foreground">
            {run.review_status === "verified" && (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Verified
              </span>
            )}
            {run.review_status === "corrected" && (
              <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <FileText className="h-3.5 w-3.5" /> Has ground truth
              </span>
            )}
          </div>
          {run.review_status !== "verified" && (
            <button
              onClick={markVerified}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Mark verified (AI was correct)
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3" style={{ borderColor: "var(--border)" }}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
