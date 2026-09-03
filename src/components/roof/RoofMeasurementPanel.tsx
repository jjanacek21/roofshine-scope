import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Map as MapIcon, FileText, Sparkles, CheckCircle2, ArrowRight, FileDown } from "lucide-react";
import { saveMeasurementPdf } from "@/lib/measurement-pdf";
import { currentCompanyId } from "@/lib/jobDocuments";
import { RoofPlanTab } from "./RoofPlanTab";
import { PropertyLocationPicker } from "./PropertyLocationPicker";
import { ConditionAITab } from "./ConditionAITab";

/**
 * ONE roof measurement wizard (docs/MEASUREMENT_INVARIANTS.md).
 *
 * The Claim Buddy editor is the only measurement UI. The old "Manual Entry"
 * and "Mapbox Draw" tabs — a second and third drawing engine — were deleted so
 * every surface behaves identically: pin drop → trace → refine corners →
 * save footprint → draw lines → label lines.
 */
type Tab = "measure" | "condition" | "report";

const TAB_LABELS: Record<Tab, { label: string; icon: typeof MapIcon }> = {
  measure: { label: "Roof Measurement", icon: Sparkles },
  condition: { label: "AI Condition", icon: Sparkles },
  report: { label: "Upload Report", icon: FileText },
};

export function RoofMeasurementPanel({
  propertyId,
  center,
}: {
  propertyId: string;
  center: { lng: number; lat: number } | null;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("measure");
  const [pickingLocation, setPickingLocation] = useState(false);

  const saveLocation = useMutation({
    mutationFn: async (coords: { lat: number; lng: number }) => {
      const { error } = await supabase
        .from("properties")
        .update({ lat: coords.lat, lng: coords.lng })
        .eq("id", propertyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Location saved — satellite view updated");
      setPickingLocation(false);
      qc.invalidateQueries({ queryKey: ["job-property"] });
      qc.invalidateQueries({ queryKey: ["property", propertyId] });
      qc.invalidateQueries({ queryKey: ["roof-measurement", propertyId] });
      setTab("measure");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to save location"),
  });

  const { data: existing } = useQuery({
    queryKey: ["roof-measurement", propertyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("roof_measurements")
        .select("*")
        .eq("property_id", propertyId)
        .maybeSingle();
      return data;
    },
  });

  const params = useParams({ strict: false }) as { id?: string };
  const jobId = params.id;
  const [savingPdf, setSavingPdf] = useState(false);

  /* The job, the customer and the address the measurement belongs to — only so
     the PDF has a header. Skipped entirely when this panel is opened from a
     client rather than a job. */
  const { data: jobCtx } = useQuery({
    queryKey: ["measurement-pdf-context", jobId, propertyId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data: job } = await supabase
        .from("jobs")
        .select("id, name, job_number, client_id, property_address")
        .eq("id", jobId!)
        .maybeSingle();
      let clientName: string | null = null;
      if (job?.client_id) {
        const { data: c } = await supabase
          .from("clients").select("name").eq("id", job.client_id).maybeSingle();
        clientName = (c as { name?: string } | null)?.name ?? null;
      }
      const { data: prop } = await supabase
        .from("properties").select("address").eq("id", propertyId).maybeSingle();
      return {
        label: job?.job_number ?? job?.name ?? null,
        clientName,
        address: (prop as { address?: string } | null)?.address ?? job?.property_address ?? null,
      };
    },
  });

  /* Turn the saved measurement into a page, and file it on the job so the
     Documents tab and any permit packet can reach it. */
  const saveAsPdf = async () => {
    if (!existing || !jobId) return;
    setSavingPdf(true);
    try {
      const companyId =
        (existing as { company_id?: string }).company_id ?? (await currentCompanyId());
      if (!companyId) {
        toast.error("We could not tell which company this job belongs to, so the PDF was not saved.");
        return;
      }
      const res = await saveMeasurementPdf({
        measurement: existing,
        jobId,
        companyId,
        jobLabel: jobCtx?.label ?? null,
        customerName: jobCtx?.clientName ?? null,
        propertyAddress: jobCtx?.address ?? null,
      });
      if (res.filed) {
        toast.success("Measurement downloaded and added to the Documents tab");
        qc.invalidateQueries({ queryKey: ["job-documents", jobId] });
      } else {
        toast.warning("Measurement downloaded, but it could not be added to the Documents tab");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The measurement PDF could not be created.");
    } finally {
      setSavingPdf(false);
    }
  };

  const sourceLabel: Record<string, string> = {
    manual: "Manual Entry",
    mapbox_draw: "Mapbox Draw",
    roof_plan: "Roof measurement",
    google_solar: "Google Solar AI",
    third_party_report: "Third-Party Report",
    photo_ai: "Photo AI",
  };

  const updatedAgo = (() => {
    if (!existing?.updated_at) return null;
    const d = new Date(existing.updated_at);
    const sec = Math.round((Date.now() - d.getTime()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
    if (sec < 86400) return `${Math.round(sec / 3600)} hr ago`;
    return d.toLocaleDateString();
  })();

  return (
    <div className="space-y-4">
      {existing && Number(existing.total_area_sqft ?? 0) > 0 && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
          style={{
            borderColor: "color-mix(in oklab, var(--success, #10b981) 30%, transparent)",
            background: "color-mix(in oklab, var(--success, #10b981) 8%, var(--bg-card))",
          }}
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--success, #10b981)" }} />
            <div>
              <div className="text-sm font-semibold text-foreground">
                Saved measurement{updatedAgo ? ` · updated ${updatedAgo}` : ""}
              </div>
              <div className="mt-0.5 font-mono-num text-[13px] text-foreground">
                {Number(existing.squares ?? 0).toFixed(1)} SQ ·{" "}
                {Number(existing.total_area_sqft ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} SF ·{" "}
                {existing.predominant_pitch ?? "—"} pitch · {Number(existing.waste_pct ?? 15)}% waste
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                Source: {sourceLabel[existing.source as string] ?? existing.source}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
          {jobId && (
            <button
              onClick={saveAsPdf}
              disabled={savingPdf}
              title="Download this measurement and add it to the job's Documents tab"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold text-foreground hover:bg-[var(--surface-hover)] disabled:opacity-50"
              style={{ borderColor: "var(--border)" }}
            >
              <FileDown className="h-3.5 w-3.5" />
              {savingPdf ? "Saving\u2026" : "Save PDF to Documents"}
            </button>
          )}
          {jobId && (
            <Link
              to="/jobs/$id/report"
              params={{ id: jobId }}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold text-foreground hover:bg-[var(--surface-hover)]"
              style={{ borderColor: "var(--border)" }}
            >
              View in Report
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
          </div>
        </div>
      )}

      {pickingLocation ? (
        <PropertyLocationPicker
          initial={center}
          isSaving={saveLocation.isPending}
          onSave={(coords) => saveLocation.mutate(coords)}
          onCancel={() => setPickingLocation(false)}
        />
      ) : (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
          style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
        >
          <div className="text-xs text-muted-foreground">
            {center ? (
              <>
                Location:{" "}
                <span className="font-mono-num text-foreground">
                  {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
                </span>
              </>
            ) : (
              "This property has no coordinates yet — drop a pin on the house to enable the map tools."
            )}
          </div>
          <button
            type="button"
            onClick={() => setPickingLocation(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold text-foreground hover:bg-[var(--surface-hover)]"
            style={{ borderColor: "var(--border)" }}
          >
            <MapIcon className="h-3.5 w-3.5" />
            {center ? "Wrong location? Set it on the map" : "Drop a pin on the house"}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        {(Object.entries(TAB_LABELS) as [Tab, (typeof TAB_LABELS)[Tab]][]).map(([k, v]) => {
          const Icon = v.icon;
          const disabled = (k === "measure" || k === "condition") && !center;
          return (
            <button
              key={k}
              onClick={() => !disabled && setTab(k)}
              disabled={disabled}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition ${
                tab === k
                  ? "border-[var(--brand)] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
              title={disabled ? "Property has no coordinates" : undefined}
            >
              <Icon className="h-3.5 w-3.5" />
              {v.label}
            </button>
          );
        })}
      </div>

      {tab === "measure" && center && (
        <RoofPlanTab propertyId={propertyId} jobId={jobId} center={center} />
      )}
      {tab === "measure" && !center && (
        <div
          className="rounded-xl border p-12 text-center text-sm text-muted-foreground"
          style={{ borderColor: "var(--border)" }}
        >
          Property has no coordinates — set the location on the map first.
        </div>
      )}
      {tab === "condition" && (
        <ConditionAITab
          propertyId={propertyId}
          center={center}
          initial={existing?.ai_analysis as Record<string, unknown> | undefined}
        />
      )}
      {tab === "report" && (
        <div
          className="rounded-xl border p-12 text-center text-sm text-muted-foreground"
          style={{ borderColor: "var(--border)" }}
        >
          Third-party report PDF upload (EagleView, Hover) — coming in Round C.
        </div>
      )}
    </div>
  );
}
