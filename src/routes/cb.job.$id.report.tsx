import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Link2, Mail, Loader2, Presentation } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbChip, CbLoading } from "@/components/cb/primitives";
import { CbStickyHeader } from "@/components/cb/motion";
import { CbReportDoc } from "@/components/cb/CbReportDoc";
import { useCbReport } from "@/lib/cbReportView";
import { cbDocumentSignedUrl, renderAndStoreReportPdf } from "@/lib/cbPdf";
import { cbEmailReport } from "@/lib/cb-email.functions";
import type { CbLineItem, CbNarrative } from "@/lib/cbReport";

export const Route = createFileRoute("/cb/job/$id/report")({
  validateSearch: (search: Record<string, unknown>) => ({ r: typeof search.r === "string" ? search.r : undefined }),
  head: () => ({
    meta: [
      { title: "Damage report — Claim Buddy" },
      {
        name: "description",
        content:
          "The carrier-ready property damage inspection report: findings by elevation, recommended scope, ventilation analysis and the full photo appendix.",
      },
      { property: "og:title", content: "Damage report — Claim Buddy" },
      { property: "og:description", content: "Every photo, every line item, one deliverable." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbReportPage,
});

function CbReportPage() {
  const { id } = useParams({ from: "/cb/job/$id/report" });
  const { r } = useSearch({ from: "/cb/job/$id/report" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useCbReport(id, r);

  const [narrative, setNarrative] = useState<CbNarrative | null>(null);
  const [lineItems, setLineItems] = useState<CbLineItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pdfStep, setPdfStep] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!data) return;
    setNarrative(data.vm.narrative);
    setLineItems(data.vm.lineItems);
  }, [data?.report.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const vm = useMemo(() => {
    if (!data) return null;
    return {
      ...data.vm,
      narrative: narrative ?? data.vm.narrative,
      lineItems: lineItems ?? data.vm.lineItems,
    };
  }, [data, narrative, lineItems]);

  function persist(next: { narrative?: CbNarrative; line_items?: CbLineItem[] }) {
    if (!data) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("cb_reports")
        .update({
          ...(next.narrative ? { narrative: next.narrative as never } : {}),
          ...(next.line_items ? { line_items: next.line_items as never } : {}),
        })
        .eq("id", data.report.id);
      if (error) toast.error("Could not save the edit");
      else qc.invalidateQueries({ queryKey: ["cb-report", id] });
    }, 600);
  }

  async function ensurePdf(): Promise<string | null> {
    if (!data || !vm) return null;
    const workspaceId = String((data.inputs.job as Record<string, unknown>)?.workspace_id ?? "");
    setBusy("pdf");
    try {
      const path = await renderAndStoreReportPdf({
        vm,
        reportId: data.report.id,
        workspaceId,
        jobId: id,
        version: data.report.version,
        onStep: setPdfStep,
      });
      return path;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF failed");
      return null;
    } finally {
      setBusy(null);
      setPdfStep(null);
    }
  }

  async function download() {
    const path = await ensurePdf();
    if (!path) return;
    const url = await cbDocumentSignedUrl(path);
    if (url) window.open(url, "_blank", "noopener");
  }

  async function share(): Promise<string | null> {
    if (!data) return null;
    const { data: token, error } = await supabase.rpc("cb_create_share_link", { _report: data.report.id, _days: 30 });
    if (error || !token) {
      toast.error("Could not create the share link");
      return null;
    }
    return `https://gcn.claims/r/${token}`;
  }

  async function copyLink() {
    setBusy("share");
    const link = await share();
    setBusy(null);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Shareable link copied — expires in 30 days");
    } catch {
      toast.message(link);
    }
  }

  async function email(kind: "homeowner" | "adjuster") {
    if (!data || !vm) return;
    const job = (data.inputs.job ?? {}) as Record<string, string | null>;
    const to =
      kind === "homeowner"
        ? job.customer_email
        : (job.adjuster_email ?? window.prompt("Adjuster email address") ?? "");
    if (!to) {
      toast.error(`No ${kind} email address on file`);
      return;
    }
    setBusy(kind);
    try {
      const path = (await ensurePdf()) ?? data.report.pdf_path;
      const link = await share();
      const res = await cbEmailReport({
        data: {
          reportId: data.report.id,
          to,
          audience: kind,
          link: link ?? undefined,
          pdfPath: path ?? undefined,
        },
      });
      if (res.ok) toast.success(`Report sent to ${to}`);
      else toast.error(res.error ?? "Could not send the email");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) {
    return (
      <CbSurface>
        <div className="min-h-screen px-5 py-16" style={{ background: "var(--cb-bg)" }}>
          <div className="mx-auto max-w-[760px]">
            <CbLoading label="Opening the report…" />
          </div>
        </div>
      </CbSurface>
    );
  }

  if (!data || !vm) {
    return (
      <CbSurface>
        <div className="min-h-screen px-5 py-16" style={{ background: "var(--cb-bg)" }}>
          <div className="mx-auto max-w-[520px]">
            <CbCard elevation="raised" style={{ padding: 24 }}>
              <h1 className="cb-display" style={{ fontSize: 20, margin: 0 }}>
                No report yet
              </h1>
              <p className="mt-2 text-[14px]" style={{ color: "var(--cb-text-muted)" }}>
                Run the pre-flight review and create the report.
              </p>
              <CbButton className="mt-4" block onClick={() => navigate({ to: "/cb/job/$id/review", params: { id } })}>
                Go to review
              </CbButton>
            </CbCard>
          </div>
        </div>
      </CbSurface>
    );
  }

  return (
    <CbSurface>
      <div className="min-h-screen px-4 pb-28 pt-4" style={{ background: "var(--cb-bg)" }}>
        <div className="mx-auto w-full max-w-[860px]">
          <CbStickyHeader>
            <div className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="flex items-center gap-2">
                <span className="cb-display" style={{ fontSize: 16 }}>
                  Damage report
                </span>
                <CbChip>v{data.report.version}</CbChip>
              </div>
              <div className="flex flex-wrap gap-2">
                <CbButton size="md" variant="secondary" onClick={download} loading={busy === "pdf"} loadingText={pdfStep ?? "Rendering…"}>
                  <Download size={16} /> Download PDF
                </CbButton>
                <CbButton size="md" variant="ghost" onClick={() => email("homeowner")} loading={busy === "homeowner"}>
                  <Mail size={16} /> Homeowner
                </CbButton>
                <CbButton size="md" variant="ghost" onClick={() => email("adjuster")} loading={busy === "adjuster"}>
                  <Mail size={16} /> Adjuster
                </CbButton>
                <CbButton size="md" variant="ghost" onClick={() => navigate({ to: "/cb/job/$id/present", params: { id } })}>
                  <Presentation size={16} /> Present
                </CbButton>
                <CbButton size="md" variant="ghost" onClick={copyLink} loading={busy === "share"}>
                  <Link2 size={16} /> Copy link
                </CbButton>
              </div>
            </div>
          </CbStickyHeader>

          {pdfStep ? (
            <p className="mt-2 flex items-center gap-2 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
              <Loader2 size={14} className="animate-spin" /> {pdfStep}
            </p>
          ) : null}

          <div className="mt-3">
            <CbReportDoc
              vm={vm}
              editable
              onNarrative={(patch) => {
                const next = { ...(narrative ?? vm.narrative), ...patch };
                setNarrative(next);
                persist({ narrative: next });
              }}
              onLineItems={(items) => {
                setLineItems(items);
                persist({ line_items: items });
              }}
            />
          </div>

          <div className="mt-6 grid gap-2">
            <CbButton
              block
              variant="secondary"
              onClick={() => navigate({ to: "/cb/job/$id/generating", params: { id } })}
            >
              Regenerate as a new version
            </CbButton>
            <CbButton block variant="ghost" onClick={() => navigate({ to: "/cb" })}>
              Back to jobs
            </CbButton>
          </div>
        </div>
      </div>
    </CbSurface>
  );
}
