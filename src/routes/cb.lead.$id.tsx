import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCbSession } from "@/components/auth/CbSessionProvider";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbButton, CbCard, CbLoading } from "@/components/cb/primitives";
import { CbReveal } from "@/components/cb/motion";
import {
  CbMeasurementReport,
  type CbMeasurementReportData,
} from "@/components/cb/CbMeasurementReport";
import { CbSupplementTab } from "@/components/cb/CbSupplementTab";
import type { CbMeasureLike } from "@/lib/cbSupplement";
import type { CbSheet } from "@/lib/cbSheet";
import { cbPhotoSignedUrl } from "@/lib/cbPhotos";
import { cbTradeColor, cbTradeLabel } from "@/lib/cbPriceBook";
import { CB_LEAD_STAGES, cbNextStage, cbStageOf, type CbLeadStage } from "@/lib/cbLeads";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/cb/lead/$id")({
  head: () => ({
    meta: [
      { title: "Lead — Claim Buddy" },
      {
        name: "description",
        content:
          "The whole lead in one file: details, measurements, photos, estimate and every document.",
      },
      { property: "og:title", content: "Lead — Claim Buddy" },
      { property: "og:description", content: "One file per lead." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbLeadPage,
});

const TABS = [
  { k: "overview", label: "Overview" },
  { k: "measure", label: "Measurements" },
  { k: "photos", label: "Photos" },
  { k: "estimate", label: "Estimate" },
  { k: "supplement", label: "Supplement" },
  { k: "docs", label: "Documents" },
] as const;
type TabKey = (typeof TABS)[number]["k"];

const money = (n: number | null | undefined) =>
  `$${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function CbLeadPage() {
  const { id } = useParams({ from: "/cb/lead/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { workspace } = useCbSession();
  const [tab, setTab] = useState<TabKey>("overview");
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* ── the job row ── */
  const { data: job, isLoading } = useQuery({
    queryKey: ["cb-lead", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cb_jobs").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Record<string, unknown> | null;
    },
  });

  const { data: measurement } = useQuery({
    queryKey: ["cb-lead-measure", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cb_measurements")
        .select("*")
        .eq("job_id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Record<string, unknown> | null;
    },
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["cb-lead-photos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cb_photos")
        .select(
          "id, storage_path, thumb_path, category, elevation, shot_type, caption, sort_order, taken_at",
        )
        .eq("job_id", id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CbPhotoRow[];
    },
  });

  const { data: estimate } = useQuery({
    queryKey: ["cb-lead-estimate", id],
    queryFn: async () => {
      const { data: est, error } = await supabase
        .from("estimates")
        .select(
          "id, total, subtotal, tax, markup_pct, overhead_pct, profit_pct, tax_pct, updated_at",
        )
        .eq("cb_job_id", id)
        .maybeSingle();
      if (error) throw error;
      if (!est) return null;
      const { data: lines } = await supabase
        .from("estimate_line_items")
        .select(
          "id, code, name, unit, qty, unit_price, total, trade, subgroup, category, sort_order",
        )
        .eq("estimate_id", (est as { id: string }).id)
        .order("sort_order", { ascending: true });
      return { est: est as EstimateRow, lines: (lines ?? []) as LineRow[] };
    },
  });

  /* The takeoff sheet — the supplement compares against it, so it is only
     fetched when that tab is the one on screen. */
  const { data: takeoff } = useQuery({
    queryKey: ["cb-lead-takeoff", id],
    enabled: tab === "supplement",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cb_takeoffs")
        .select("data")
        .eq("job_id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as { data?: { sheet?: unknown } } | null;
    },
  });

  const { data: docs = [], isLoading: docsLoading } = useQuery({
    queryKey: ["cb-lead-docs", id],
    queryFn: async () => {
      const out: DocRow[] = [];
      const { data: reports } = await supabase
        .from("cb_reports")
        .select("id, version, pdf_path, generated_at")
        .eq("job_id", id)
        .order("version", { ascending: false });
      (reports ?? []).forEach((r) => {
        const row = r as {
          id: string;
          version: number;
          pdf_path: string | null;
          generated_at: string | null;
        };
        out.push({
          id: row.id,
          title: `Damage report — v${row.version}`,
          kind: "DMG",
          color: "#b45309",
          date: row.generated_at,
          path: row.pdf_path,
          note: "Filed when the report was generated",
        });
      });
      const { data: contracts } = await supabase
        .from("cb_contracts")
        .select("id, doc_type, pdf_path, signer_name, signed_at, created_at")
        .eq("job_id", id)
        .order("created_at", { ascending: false });
      (contracts ?? []).forEach((c) => {
        const row = c as {
          id: string;
          doc_type: string | null;
          pdf_path: string | null;
          signer_name: string | null;
          signed_at: string | null;
          created_at: string;
        };
        out.push({
          id: row.id,
          title: row.doc_type ? row.doc_type.replace(/_/g, " ") : "Agreement",
          kind: row.signed_at ? "SIGN" : "DRAFT",
          color: row.signed_at ? "#7c3aed" : "#94a3b8",
          date: row.signed_at ?? row.created_at,
          path: row.pdf_path,
          note: row.signed_at
            ? `Signed by ${row.signer_name ?? "the homeowner"}`
            : "Sent, waiting on signature",
        });
      });
      return out;
    },
  });

  /* ── inline edits ── */
  const save = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase
        .from("cb_jobs")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cb-lead", id] });
      qc.invalidateQueries({ queryKey: ["cb-leads", workspace?.id] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  });

  /* Deleting used to live on the dashboard list. That list is gone, so the
     capability lives here — on the lead it actually belongs to. */
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cb_jobs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      setConfirmDelete(false);
      toast.success("Lead deleted");
      await qc.invalidateQueries({ queryKey: ["cb-leads", workspace?.id] });
      await qc.invalidateQueries({ queryKey: ["cb-jobs", workspace?.id] });
      navigate({ to: "/cb/leads" });
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete the lead"),
  });

  const stage = cbStageOf(job?.status as string | undefined);
  const next = cbNextStage(job?.status as string | undefined);

  const measureData: CbMeasurementReportData | null = useMemo(() => {
    if (!measurement) return null;
    const m = measurement as Record<string, number | string | null>;
    return {
      total_area_sqft: Number(m.total_area_sqft ?? 0),
      total_squares: Number(m.total_squares ?? 0),
      waste_pct: Number(m.waste_pct ?? 0),
      pitch: (m.pitch as string | null) ?? null,
      eave_lf: Number(m.eave_lf ?? 0),
      ridge_lf: Number(m.ridge_lf ?? 0),
      hip_lf: Number(m.hip_lf ?? 0),
      valley_lf: Number(m.valley_lf ?? 0),
      rake_lf: Number(m.rake_lf ?? 0),
    };
  }, [measurement]);

  if (isLoading) {
    return (
      <CbSurface>
        <div className="min-h-screen" style={{ background: "var(--cb-bg)" }}>
          <CbLoading label="Opening the lead…" />
        </div>
      </CbSurface>
    );
  }

  if (!job) {
    return (
      <CbSurface>
        <div className="min-h-screen p-6" style={{ background: "var(--cb-bg)" }}>
          <p className="text-sm">That lead is not on this workspace.</p>
          <div className="mt-4">
            <CbButton variant="secondary" size="md" onClick={() => navigate({ to: "/cb/leads" })}>
              Back to leads
            </CbButton>
          </div>
        </div>
      </CbSurface>
    );
  }

  const j = job as Record<string, string | number | null>;

  return (
    <CbSurface>
      <div className="min-h-screen" style={{ background: "var(--cb-bg)" }}>
        {/* header */}
        <header
          className="sticky top-0 z-30"
          style={{ background: "var(--cb-surface)", borderBottom: "1px solid var(--cb-border)" }}
        >
          <div className="mx-auto w-full max-w-[900px] px-4 pt-2.5 sm:px-5">
            <div className="flex items-start gap-2.5">
              <button
                type="button"
                aria-label="Back to leads"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-[11px] border"
                style={{ borderColor: "var(--cb-border)" }}
                onClick={() => navigate({ to: "/cb/leads" })}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1 pt-0.5">
                <h1 className="truncate text-[17.5px] font-extrabold leading-tight tracking-tight">
                  {(j.address as string) || "No address yet"}
                </h1>
                <p className="truncate text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                  {[j.customer_name, [j.city, j.state, j.zip].filter(Boolean).join(", ")]
                    .filter(Boolean)
                    .join(" · ") || "No customer yet"}
                </p>
              </div>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-bold"
                style={{
                  color: stage.color,
                  background: `color-mix(in srgb, ${stage.color} 12%, transparent)`,
                  borderColor: `color-mix(in srgb, ${stage.color} 34%, transparent)`,
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
                {stage.label}
              </span>
              {j.carrier ? <Chip>{j.carrier as string}</Chip> : null}
              {j.claim_number ? <Chip mono>{j.claim_number as string}</Chip> : null}
            </div>

            <div
              className="-mx-4 mt-2 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0"
              role="tablist"
            >
              {TABS.map((t) => {
                const on = tab === t.k;
                const badge =
                  t.k === "photos"
                    ? photos.length
                    : t.k === "estimate"
                      ? (estimate?.lines.length ?? 0)
                      : t.k === "docs"
                        ? docs.length
                        : null;
                return (
                  <button
                    key={t.k}
                    role="tab"
                    aria-selected={on}
                    type="button"
                    onClick={() => setTab(t.k)}
                    className="flex shrink-0 items-center gap-1.5 px-3 pb-2.5 pt-2 text-[14px] font-semibold"
                    style={{
                      color: on ? "var(--cb-text)" : "var(--cb-text-muted)",
                      borderBottom: `2.5px solid ${on ? "var(--cb-accent)" : "transparent"}`,
                    }}
                  >
                    {t.label}
                    {badge ? (
                      <span
                        className="rounded-full px-1.5 py-px font-mono text-[10.5px] font-bold"
                        style={{
                          background: on
                            ? "color-mix(in srgb, var(--cb-accent) 14%, transparent)"
                            : "var(--cb-bg-hover, rgba(0,0,0,.06))",
                          color: on ? "var(--cb-accent)" : "var(--cb-text-muted)",
                        }}
                      >
                        {badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[900px] px-4 pb-28 pt-4 sm:px-5">
          {tab === "overview" ? (
            <OverviewTab
              j={j}
              onSave={(p) => save.mutate(p)}
              saving={save.isPending}
              jobId={id}
              onDelete={() => setConfirmDelete(true)}
            />
          ) : null}

          {tab === "measure" ? (
            <CbReveal>
              {measureData ? (
                <>
                  <CbMeasurementReport
                    jobId={id}
                    measurement={measureData}
                    lat={j.lat != null ? Number(j.lat) : null}
                    lng={j.lng != null ? Number(j.lng) : null}
                  />
                  <CbCard style={{ padding: 18, marginTop: 12 }}>
                    <SectionLabel>Line lengths</SectionLabel>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-[13px]">
                        <tbody>
                          {(
                            [
                              ["Eave", measurement?.eave_lf],
                              ["Ridge", measurement?.ridge_lf],
                              ["Ridge cap", measurement?.ridge_cap_lf],
                              ["Hip", measurement?.hip_lf],
                              ["Valley", measurement?.valley_lf],
                              ["Rake", measurement?.rake_lf],
                              ["Drip edge", measurement?.drip_edge_lf],
                              ["Starter", measurement?.starter_lf],
                              ["Step flashing", measurement?.step_flashing_lf],
                              ["Wall flashing", measurement?.wall_flashing_lf],
                              ["Gutter", measurement?.gutter_lf],
                            ] as [string, unknown][]
                          )
                            .filter(([, v]) => v != null && Number(v) > 0)
                            .map(([k, v]) => (
                              <tr key={k} style={{ borderBottom: "1px solid var(--cb-border)" }}>
                                <td className="py-2">{k}</td>
                                <td className="py-2 text-right font-mono">
                                  {Number(v).toLocaleString()} LF
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </CbCard>
                </>
              ) : (
                <Empty>No takeoff on this lead yet.</Empty>
              )}
              <div className="mt-3">
                <CbButton
                  variant="secondary"
                  size="md"
                  onClick={() => navigate({ to: "/cb/job/$id/measure", params: { id } })}
                >
                  Open the measurement workspace
                </CbButton>
              </div>
            </CbReveal>
          ) : null}

          {tab === "photos" ? <PhotosTab photos={photos} jobId={id} /> : null}

          {tab === "estimate" ? (
            <CbReveal>
              {estimate && estimate.lines.length ? (
                <>
                  <EstimateLines lines={estimate.lines} />
                  <CbCard style={{ padding: 18, marginTop: 12 }}>
                    <SectionLabel>Totals</SectionLabel>
                    <Row k="Subtotal" v={money(estimate.est.subtotal)} />
                    <Row k={`Markup ${estimate.est.markup_pct ?? 0}%`} v="" />
                    <Row k={`Overhead ${estimate.est.overhead_pct ?? 0}%`} v="" />
                    <Row k={`Profit ${estimate.est.profit_pct ?? 0}%`} v="" />
                    <Row k={`Tax ${estimate.est.tax_pct ?? 0}%`} v={money(estimate.est.tax)} />
                    <div
                      className="mt-2 flex items-baseline gap-3 border-t pt-3"
                      style={{ borderColor: "var(--cb-border)" }}
                    >
                      <span className="flex-1 text-[12px] font-extrabold uppercase tracking-[.08em]">
                        Grand total
                      </span>
                      <span
                        className="font-mono text-[24px] font-extrabold"
                        style={{ color: "var(--cb-accent)" }}
                      >
                        {money(estimate.est.total)}
                      </span>
                    </div>
                  </CbCard>
                </>
              ) : (
                <Empty>No line items yet. Open the estimate builder to scope this roof.</Empty>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <CbButton
                  variant="primary"
                  size="md"
                  onClick={() => navigate({ to: "/cb/job/$id/estimate", params: { id } })}
                >
                  Open the estimate builder
                </CbButton>
                <CbButton
                  variant="ghost"
                  size="md"
                  onClick={() => navigate({ to: "/cb/job/$id/present", params: { id } })}
                >
                  Carrier report
                </CbButton>
              </div>
            </CbReveal>
          ) : null}

          {tab === "supplement" ? (
            <CbReveal>
              <CbSupplementTab
                jobId={id}
                workspaceId={(job?.workspace_id as string | undefined) ?? workspace?.id ?? null}
                job={{
                  state: (job?.state as string | null) ?? null,
                  county: (job?.county as string | null) ?? null,
                  zip: (job?.zip as string | null) ?? null,
                }}
                measure={(measurement ?? null) as CbMeasureLike | null}
                sheet={(takeoff?.data?.sheet ?? null) as Partial<CbSheet> | null}
                estimateId={estimate?.est.id ?? null}
              />
            </CbReveal>
          ) : null}

          {tab === "docs" ? (
            <CbReveal>
              <CbCard style={{ padding: 18 }}>
                <SectionLabel>Documents on file</SectionLabel>
                {docsLoading ? (
                  <div className="flex items-center gap-2 py-6 text-sm opacity-70">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : docs.length === 0 ? (
                  <p
                    className="py-6 text-center text-[13px]"
                    style={{ color: "var(--cb-text-muted)" }}
                  >
                    Nothing generated yet. Build the damage report and a PDF files itself here.
                  </p>
                ) : (
                  docs.map((d) => <DocRowView key={d.id} d={d} />)
                )}
              </CbCard>
              <p
                className="mt-3 text-[11.5px] leading-relaxed"
                style={{ color: "var(--cb-text-muted)" }}
              >
                Anything the app produces lands here on its own — the damage report when it is
                generated, the signed agreement the moment the homeowner signs.
              </p>
            </CbReveal>
          ) : null}
        </div>

        {/* action bar */}
        <div
          className="sticky bottom-0 z-30 flex gap-2 px-4 py-2.5 sm:px-5"
          style={{
            background: "var(--cb-surface)",
            borderTop: "1px solid var(--cb-border)",
            paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
          }}
        >
          <div className="mx-auto flex w-full max-w-[900px] gap-2">
            <CbButton
              variant="ghost"
              size="md"
              onClick={() => navigate({ to: "/cb/job/$id/customer", params: { id } })}
            >
              Inspection
            </CbButton>
            <div className="flex-1" />
            <CbButton
              variant="primary"
              size="md"
              loading={save.isPending}
              onClick={() => {
                if (next.next) save.mutate({ status: next.next });
                else navigate({ to: "/cb/job/$id/present", params: { id } });
              }}
            >
              {next.label}
            </CbButton>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              {(j.address as string) || "This lead"} and all of its photos, measurements, reports
              and contracts will be permanently removed. This can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                remove.mutate();
              }}
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CbSurface>
  );
}

/* ───────────────────────── pieces ───────────────────────── */

interface CbPhotoRow {
  id: string;
  storage_path: string;
  thumb_path: string | null;
  category: string | null;
  elevation: string | null;
  shot_type: string | null;
  caption: string | null;
  sort_order: number | null;
  taken_at: string | null;
}
interface EstimateRow {
  id: string;
  total: number | null;
  subtotal: number | null;
  tax: number | null;
  markup_pct: number | null;
  overhead_pct: number | null;
  profit_pct: number | null;
  tax_pct: number | null;
  updated_at: string | null;
}
interface LineRow {
  id: string;
  code: string | null;
  name: string;
  unit: string | null;
  qty: number | null;
  unit_price: number | null;
  total: number | null;
  trade: string | null;
  subgroup: string | null;
  category: string | null;
  sort_order: number | null;
}
interface DocRow {
  id: string;
  title: string;
  kind: string;
  color: string;
  date: string | null;
  path: string | null;
  note: string;
}

function Chip({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11.5px] ${mono ? "font-mono text-[11px]" : ""}`}
      style={{ borderColor: "var(--cb-border)", color: "var(--cb-text-muted)" }}
    >
      {children}
    </span>
  );
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[10.5px] font-bold uppercase tracking-[.09em]"
      style={{ color: "var(--cb-text-muted)" }}
    >
      {children}
    </span>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[18px] border border-dashed px-6 py-10 text-center text-[13.5px]"
      style={{ borderColor: "var(--cb-border)", color: "var(--cb-text-muted)" }}
    >
      {children}
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="flex-1 text-[13.5px]" style={{ color: "var(--cb-text-dim)" }}>
        {k}
      </span>
      <span className="font-mono text-[13.5px] font-semibold">{v}</span>
    </div>
  );
}

/** One editable field. Commits on blur so a phone keyboard never fights it. */
function Field({
  label,
  value,
  onCommit,
  type = "text",
}: {
  label: string;
  value: string | number | null;
  onCommit: (v: string) => void;
  type?: string;
}) {
  const [v, setV] = useState(value == null ? "" : String(value));
  useEffect(() => {
    setV(value == null ? "" : String(value));
  }, [value]);
  return (
    <div
      className="flex items-center gap-3 border-b py-2"
      style={{ borderColor: "var(--cb-border)" }}
    >
      <span
        className="w-[38%] max-w-[150px] shrink-0 text-[12.5px]"
        style={{ color: "var(--cb-text-muted)" }}
      >
        {label}
      </span>
      <input
        type={type}
        className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1.5 text-right text-[14px] font-semibold outline-none focus:border-[var(--cb-accent)] focus:text-left"
        style={{ background: "transparent", color: v ? "var(--cb-text)" : "var(--cb-text-muted)" }}
        placeholder="Not set"
        aria-label={label}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const next = v.trim();
          if (next !== (value == null ? "" : String(value))) onCommit(next);
        }}
      />
    </div>
  );
}

function OverviewTab({
  j,
  onSave,
  saving,
  jobId,
  onDelete,
}: {
  j: Record<string, string | number | null>;
  onSave: (patch: Record<string, unknown>) => void;
  saving: boolean;
  jobId: string;
  onDelete: () => void;
}) {
  const num = (v: string) => (v === "" ? null : Number(v));
  return (
    <CbReveal>
      <CbCard style={{ padding: 18, marginBottom: 12 }}>
        <SectionLabel>Customer</SectionLabel>
        <div className="mt-2">
          <Field
            label="Name"
            value={j.customer_name}
            onCommit={(v) => onSave({ customer_name: v || null })}
          />
          <Field
            label="Phone"
            type="tel"
            value={j.customer_phone}
            onCommit={(v) => onSave({ customer_phone: v || null })}
          />
          <Field
            label="Email"
            type="email"
            value={j.customer_email}
            onCommit={(v) => onSave({ customer_email: v || null })}
          />
        </div>
      </CbCard>

      <CbCard style={{ padding: 18, marginBottom: 12 }}>
        <SectionLabel>Property</SectionLabel>
        <div className="mt-2">
          <Field
            label="Address"
            value={j.address}
            onCommit={(v) => onSave({ address: v || null })}
          />
          <Field label="City" value={j.city} onCommit={(v) => onSave({ city: v || null })} />
          <Field label="State" value={j.state} onCommit={(v) => onSave({ state: v || null })} />
          <Field label="ZIP" value={j.zip} onCommit={(v) => onSave({ zip: v || null })} />
        </div>
      </CbCard>

      <CbCard style={{ padding: 18, marginBottom: 12 }}>
        <SectionLabel>Claim</SectionLabel>
        <div className="mt-2">
          <Field
            label="Carrier"
            value={j.carrier}
            onCommit={(v) => onSave({ carrier: v || null })}
          />
          <Field
            label="Claim #"
            value={j.claim_number}
            onCommit={(v) => onSave({ claim_number: v || null })}
          />
          <Field
            label="Deductible"
            type="number"
            value={j.deductible}
            onCommit={(v) => onSave({ deductible: num(v) })}
          />
          <Field
            label="Date of loss"
            type="date"
            value={j.date_of_loss}
            onCommit={(v) => onSave({ date_of_loss: v || null })}
          />
          <Field
            label="Adjuster"
            value={j.adjuster_name}
            onCommit={(v) => onSave({ adjuster_name: v || null })}
          />
          <Field
            label="Adjuster phone"
            type="tel"
            value={j.adjuster_phone}
            onCommit={(v) => onSave({ adjuster_phone: v || null })}
          />
        </div>
      </CbCard>

      <CbCard style={{ padding: 18 }}>
        <SectionLabel>Stage</SectionLabel>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {CB_LEAD_STAGES.map((s) => {
            const on = j.status === s.value;
            return (
              <button
                key={s.value}
                type="button"
                disabled={saving}
                onClick={() => onSave({ status: s.value as CbLeadStage })}
                className="rounded-full border px-3 py-1.5 text-[12px] font-bold"
                style={
                  on
                    ? { background: s.color, borderColor: s.color, color: "#fff" }
                    : {
                        color: s.color,
                        background: `color-mix(in srgb, ${s.color} 10%, transparent)`,
                        borderColor: `color-mix(in srgb, ${s.color} 32%, transparent)`,
                      }
                }
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
          Moving a lead here updates the counts on the leads screen. Job id{" "}
          <span className="font-mono">{jobId.slice(0, 8)}</span>.
        </p>
      </CbCard>

      <div className="mt-3">
        <CbButton variant="ghost" size="md" onClick={onDelete}>
          <span
            className="inline-flex items-center gap-2"
            style={{ color: "var(--danger, #dc2626)" }}
          >
            <Trash2 className="h-4 w-4" /> Delete this lead
          </span>
        </CbButton>
      </div>
    </CbReveal>
  );
}

function PhotosTab({ photos, jobId }: { photos: CbPhotoRow[]; jobId: string }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>("all");
  const cats = useMemo(() => {
    const s = new Set<string>();
    photos.forEach((p) => p.category && s.add(p.category));
    return [...s].sort();
  }, [photos]);
  const rows = filter === "all" ? photos : photos.filter((p) => p.category === filter);

  return (
    <CbReveal>
      {photos.length === 0 ? (
        <Empty>No photos on this lead yet.</Empty>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div
              className="inline-flex gap-0.5 overflow-x-auto rounded-full p-[3px]"
              style={{ background: "var(--cb-bg-hover, rgba(0,0,0,.05))" }}
            >
              {["all", ...cats].map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={filter === c}
                  onClick={() => setFilter(c)}
                  className="shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-semibold capitalize"
                  style={
                    filter === c
                      ? { background: "var(--cb-surface)", color: "var(--cb-text)" }
                      : { color: "var(--cb-text-muted)" }
                  }
                >
                  {c}
                </button>
              ))}
            </div>
            <span className="ml-auto text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
              {rows.length} of {photos.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {rows.map((p) => (
              <PhotoTile key={p.id} p={p} />
            ))}
          </div>
        </>
      )}
      <div className="mt-3">
        <CbButton
          variant="secondary"
          size="md"
          onClick={() => navigate({ to: "/cb/job/$id/roof", params: { id: jobId } })}
        >
          Open the inspection
        </CbButton>
      </div>
    </CbReveal>
  );
}

function PhotoTile({ p }: { p: CbPhotoRow }) {
  const { data: url } = useQuery({
    queryKey: ["cb-lead-photo-url", p.thumb_path ?? p.storage_path],
    staleTime: 45 * 60 * 1000,
    queryFn: () => cbPhotoSignedUrl(p.thumb_path ?? p.storage_path),
  });
  return (
    <figure
      className="overflow-hidden rounded-[14px] border"
      style={{ background: "var(--cb-surface)", borderColor: "var(--cb-border)" }}
    >
      <div
        className="aspect-[4/3] w-full"
        style={{ background: "var(--cb-bg-hover, rgba(0,0,0,.06))" }}
      >
        {url ? (
          <img
            src={url}
            alt={p.caption ?? p.category ?? "Inspection photo"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>
      <figcaption className="px-2.5 py-2">
        <b className="block truncate text-[12.5px] font-bold">
          {p.caption || p.category || "Photo"}
        </b>
        <span className="block truncate text-[11px]" style={{ color: "var(--cb-text-muted)" }}>
          {[p.elevation, p.shot_type].filter(Boolean).join(" · ") || "—"}
        </span>
      </figcaption>
    </figure>
  );
}

function EstimateLines({ lines }: { lines: LineRow[] }) {
  /* Group the way the price book is browsed: trade, then sub-group. */
  const grouped = useMemo(() => {
    const byTrade = new Map<string, Map<string, LineRow[]>>();
    lines.forEach((l) => {
      const t = l.trade ?? "misc";
      const s = (l.subgroup ?? l.category ?? "").trim() || "Other items";
      if (!byTrade.has(t)) byTrade.set(t, new Map());
      const m = byTrade.get(t)!;
      m.set(s, [...(m.get(s) ?? []), l]);
    });
    return [...byTrade.entries()];
  }, [lines]);

  return (
    <div className="flex flex-col gap-3">
      {grouped.map(([trade, subs]) => {
        const amt = [...subs.values()].flat().reduce((a, l) => a + Number(l.total ?? 0), 0);
        return (
          <div
            key={trade}
            className="overflow-hidden rounded-[14px] border"
            style={{ background: "var(--cb-surface)", borderColor: "var(--cb-border)" }}
          >
            <div
              className="flex items-center gap-2.5 border-b px-3 py-2.5"
              style={{
                borderColor: "var(--cb-border)",
                background: "var(--cb-bg-hover, rgba(0,0,0,.03))",
              }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: cbTradeColor(trade) }}
              />
              <b className="flex-1 text-[13px] font-extrabold">{cbTradeLabel(trade)}</b>
              <span className="font-mono text-[13px] font-bold">{money(amt)}</span>
            </div>
            {[...subs.entries()].map(([sub, items]) => (
              <div key={sub}>
                <div
                  className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[.06em]"
                  style={{ color: "var(--cb-text-muted)" }}
                >
                  {sub}
                </div>
                {items.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-start gap-2 border-t px-3 py-2.5"
                    style={{ borderColor: "var(--cb-border)" }}
                  >
                    <span
                      className="mt-0.5 shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] font-bold opacity-70"
                      style={{ borderColor: "var(--cb-border)" }}
                    >
                      {l.code ?? "—"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <b className="block text-[13.5px] font-semibold leading-snug">{l.name}</b>
                      <div
                        className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11.5px]"
                        style={{ color: "var(--cb-text-muted)" }}
                      >
                        <span>
                          {Number(l.qty ?? 0).toLocaleString()} {(l.unit ?? "EA").toUpperCase()}
                        </span>
                        <span>× {money(l.unit_price)}</span>
                        <span
                          className="ml-auto text-[13.5px] font-bold"
                          style={{ color: "var(--cb-text)" }}
                        >
                          {money(l.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function DocRowView({ d }: { d: DocRow }) {
  const [busy, setBusy] = useState(false);
  async function open() {
    if (!d.path) {
      toast.error("No PDF stored for this one yet");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.storage
      .from("cb-documents")
      .createSignedUrl(d.path, 600);
    setBusy(false);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "Could not open that document");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }
  return (
    <div
      className="flex items-center gap-3 border-b py-3 last:border-b-0"
      style={{ borderColor: "var(--cb-border)" }}
    >
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-[11px] border font-mono text-[10.5px] font-extrabold"
        style={{
          color: d.color,
          background: `color-mix(in srgb, ${d.color} 12%, transparent)`,
          borderColor: `color-mix(in srgb, ${d.color} 34%, transparent)`,
        }}
      >
        {d.kind}
      </div>
      <div className="min-w-0 flex-1">
        <b className="block truncate text-[14px] font-bold capitalize">{d.title}</b>
        <span className="block truncate text-[11.5px]" style={{ color: "var(--cb-text-muted)" }}>
          {d.date ? new Date(d.date).toLocaleDateString() : "—"} · {d.note}
        </span>
      </div>
      <button
        type="button"
        aria-label={`Open ${d.title}`}
        disabled={busy}
        onClick={open}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border"
        style={{ borderColor: "var(--cb-border)", color: "var(--cb-text-muted)" }}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : d.path ? (
          <Download className="h-4 w-4" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
