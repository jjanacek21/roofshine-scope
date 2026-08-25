import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Link2, Mail, Loader2, Presentation, Calculator, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbChip, CbLoading, CbSheet } from "@/components/cb/primitives";
import { useIsMobile } from "@/hooks/use-mobile";
import { CbStickyHeader } from "@/components/cb/motion";
import { CbReportTemplate } from "@/components/cb/CbReportTemplate";
import { CbReportReview } from "@/components/cb/CbReportReview";
import { XrFit } from "@/components/estimate/XrFit";
import { CB_EMPTY_AI, type CbAiReport } from "@/lib/cbReportAi";
import { CbConvertAction, CbConvertedNotice } from "@/components/cb/CbConvertAction";
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
  const [tab, setTab] = useState<"review" | "document">("review");
  const docRef = useRef<HTMLDivElement>(null);
  const [lineItems, setLineItems] = useState<CbLineItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pdfStep, setPdfStep] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const isMobile = useIsMobile();
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
    setTab("document");
    await new Promise((r) => setTimeout(r, 400));
    const element = docRef.current;
    if (!element) {
      toast.error("The report document is still loading");
      return null;
    }
    const workspaceId = String((data.inputs.job as Record<string, unknown>)?.workspace_id ?? "");
    setBusy("pdf");
    try {
      const path = await renderAndStoreReportPdf({
        element,
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

  const ai: CbAiReport = { ...CB_EMPTY_AI, ...(vm?.narrative.ai ?? {}) };

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
            {isMobile ? (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="cb-display truncate" style={{ fontSize: 15 }}>
                    Damage report
                  </span>
                  <CbChip>v{data.report.version}</CbChip>
                </div>
                <div className="flex shrink-0 gap-2">
                  <CbButton size="md" variant="secondary" onClick={download} loading={busy === "pdf"} loadingText="…">
                    <Download size={16} /> PDF
                  </CbButton>
                  <CbButton size="md" variant="ghost" onClick={() => setActionsOpen(true)}>
                    <MoreHorizontal size={16} /> More
                  </CbButton>
                </div>
              </div>
            ) : (
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
                  <CbButton size="md" variant="ghost" onClick={() => navigate({ to: "/cb/job/$id/estimate", params: { id } })}>
                    <Calculator size={16} /> Estimate
                  </CbButton>
                  <CbButton size="md" variant="ghost" onClick={() => navigate({ to: "/cb/job/$id/present", params: { id } })}>
                    <Presentation size={16} /> Present
                  </CbButton>

                  <CbButton size="md" variant="ghost" onClick={copyLink} loading={busy === "share"}>
                    <Link2 size={16} /> Copy link
                  </CbButton>
                </div>
              </div>
            )}
          </CbStickyHeader>

          <CbSheet open={actionsOpen} onClose={() => setActionsOpen(false)} title="Report actions">
            <div className="grid gap-2 pb-2">
              <CbButton block size="lg" variant="secondary" onClick={download} loading={busy === "pdf"} loadingText={pdfStep ?? "Rendering…"}>
                <Download size={18} /> Download PDF
              </CbButton>
              <CbButton block size="lg" variant="ghost" onClick={() => email("homeowner")} loading={busy === "homeowner"}>
                <Mail size={18} /> Email homeowner
              </CbButton>
              <CbButton block size="lg" variant="ghost" onClick={() => email("adjuster")} loading={busy === "adjuster"}>
                <Mail size={18} /> Email adjuster
              </CbButton>
              <CbButton block size="lg" variant="ghost" onClick={() => navigate({ to: "/cb/job/$id/estimate", params: { id } })}>
                <Calculator size={18} /> Estimate
              </CbButton>
              <CbButton block size="lg" variant="ghost" onClick={() => navigate({ to: "/cb/job/$id/present", params: { id } })}>
                <Presentation size={18} /> Present
              </CbButton>
              <CbButton block size="lg" variant="ghost" onClick={copyLink} loading={busy === "share"}>
                <Link2 size={18} /> Copy link
              </CbButton>
            </div>
          </CbSheet>


          {pdfStep ? (
            <p className="mt-2 flex items-center gap-2 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
              <Loader2 size={14} className="animate-spin" /> {pdfStep}
            </p>
          ) : null}

          <div className="mt-3">
            <CbConvertedNotice jobId={id} />
          </div>

          <div className="mt-3 flex gap-2">
            <CbButton size="md" variant={tab === "review" ? "primary" : "ghost"} onClick={() => setTab("review")}>
              Review &amp; edit
            </CbButton>
            <CbButton size="md" variant={tab === "document" ? "primary" : "ghost"} onClick={() => setTab("document")}>
              Document
            </CbButton>
          </div>

          <div className="mt-3" style={{ display: tab === "review" ? "block" : "none" }}>
            <CbReportReview
              ai={ai}
              photos={vm.photos}
              onChange={(next) => {
                const nextNarrative = { ...(narrative ?? vm.narrative), ai: next };
                setNarrative(nextNarrative);
                persist({ narrative: nextNarrative });
              }}
            />
          </div>

          <div className="mt-3" style={{ display: tab === "document" ? "block" : "none" }}>
            <XrFit ref={docRef}>
              <CbReportTemplate vm={vm} ai={ai} />
            </XrFit>
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
          <div aria-hidden className="cb-has-dock" />
          <div className="cb-dock">
            <CbConvertAction jobId={id} />
          </div>
        </div>
      </div>
    </CbSurface>
  );
}
