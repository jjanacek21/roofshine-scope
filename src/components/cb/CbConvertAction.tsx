/**
 * "Add as a job in GlobalContractor" — the payoff for anyone holding both accounts.
 *
 * Visibility comes from cb_can_convert. The push is cb_convert_to_job, one
 * server-side transaction, idempotent.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUpRight, Building2, Check, ExternalLink } from "lucide-react";
import { CbButton, CbSheet, CbBadge, CbSkeleton } from "@/components/cb/primitives";
import {
  cbCanConvertKey,
  cbConvertToJob,
  useCbCanConvert,
  useCbConvertSummary,
  type CbConvertSummary,
} from "@/lib/cbConvert";

const LABEL = "Add as a job in GlobalContractor";

export function CbConvertAction({
  jobId,
  size = "full",
  className = "",
}: {
  jobId: string;
  size?: "full" | "compact";
  className?: string;
}) {
  const qc = useQueryClient();
  const { data: gate, isLoading } = useCbCanConvert(jobId);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const summary = useCbConvertSummary(jobId, open);

  if (isLoading) {
    return size === "compact" ? null : <CbSkeleton height={52} radius={14} className={className} />;
  }
  if (!gate) return null;
  if (gate.reason === "no_globalcontractor_account" || gate.reason === "no_access_to_job") return null;

  if (gate.reason === "already_converted" && gate.gc_job_id) {
    return (
      <Link
        to="/jobs/$id"
        params={{ id: gate.gc_job_id }}
        className={className}
        onClick={(e) => e.stopPropagation()}
      >
        <CbButton
          size={size === "compact" ? "md" : "lg"}
          variant="secondary"
          block={size === "full"}
          type="button"
        >
          <span className="inline-flex items-center gap-2">
            <ExternalLink size={16} /> View in GlobalContractor
          </span>
        </CbButton>
      </Link>
    );
  }

  if (!gate.can_convert) return null;

  async function convert() {
    setBusy(true);
    try {
      const res = await cbConvertToJob(jobId);
      qc.invalidateQueries({ queryKey: cbCanConvertKey(jobId) });
      qc.invalidateQueries({ queryKey: ["cb-jobs"] });
      qc.invalidateQueries({ queryKey: ["cb-open-inspections"] });
      setOpen(false);
      if (res.already) {
        toast.success("Already in GlobalContractor", {
          action: { label: "Open job", onClick: () => window.open(`/jobs/${res.gc_job_id}`, "_self") },
        });
      } else {
        toast.success("Job created in GlobalContractor", {
          description: `${res.photos_linked} photo${res.photos_linked === 1 ? "" : "s"} linked`,
          action: { label: "Open job", onClick: () => window.open(`/jobs/${res.gc_job_id}`, "_self") },
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the job");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={className} onClick={(e) => e.stopPropagation()}>
        <CbButton
          size={size === "compact" ? "md" : "lg"}
          variant={size === "compact" ? "secondary" : "primary"}
          block={size === "full"}
          onClick={() => setOpen(true)}
        >
          <span className="inline-flex items-center gap-2">
            <ArrowUpRight size={17} /> {size === "compact" ? "Add to GlobalContractor" : LABEL}
          </span>
        </CbButton>
        {size === "full" && gate.gc_company_name ? (
          <p className="mt-2 text-center text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
            Creates a job in {gate.gc_company_name}
          </p>
        ) : null}
      </div>

      <CbSheet
        open={open}
        onClose={() => (busy ? undefined : setOpen(false))}
        title={LABEL}
        footer={
          <div className="grid gap-2">
            <CbButton block loading={busy} loadingText="Creating the job…" onClick={convert}>
              Create the job
            </CbButton>
            <CbButton block variant="ghost" onClick={() => setOpen(false)}>
              Not yet
            </CbButton>
          </div>
        }
      >
        <div className="flex items-center gap-2">
          <Building2 size={16} style={{ color: "var(--cb-text-muted)" }} />
          <p className="text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
            Everything below is pushed into <strong>{gate.gc_company_name ?? "GlobalContractor"}</strong>.
          </p>
        </div>
        <div className="mt-4 grid gap-2">
          {summary.isLoading || !summary.data ? (
            <>
              <CbSkeleton height={22} />
              <CbSkeleton height={22} />
              <CbSkeleton height={22} />
            </>
          ) : (
            <ConvertLines s={summary.data} />
          )}
        </div>
      </CbSheet>
    </>
  );
}

function ConvertLines({ s }: { s: CbConvertSummary }) {
  const rows: [string, string, boolean][] = [
    ["Customer", s.customerName || "Not set", !!s.customerName],
    ["Property", s.address || "Not set", !!s.address],
    [
      "Claim",
      [s.carrier, s.claimNumber].filter(Boolean).join(" · ") || "No claim info",
      !!(s.carrier || s.claimNumber),
    ],
    [
      "Scope",
      s.lineItemCount ? `${s.lineItemCount} line item${s.lineItemCount === 1 ? "" : "s"}` : "No line items",
      s.lineItemCount > 0,
    ],
    [
      "Measurements",
      s.hasMeasurement ? `${s.squares?.toFixed(1) ?? "—"} squares` : "None on file",
      s.hasMeasurement,
    ],
    ["Photos", `${s.photoCount}`, s.photoCount > 0],
    ["Report PDF", s.hasReportPdf ? "Attached" : "Not generated", s.hasReportPdf],
    ["Signed agreement", s.hasSignedContract ? "Attached" : "Not signed", s.hasSignedContract],
  ];
  return (
    <ul className="grid gap-2">
      {rows.map(([label, value, ok]) => (
        <li
          key={label}
          className="flex items-center justify-between gap-3 rounded-[12px] px-3 py-2"
          style={{
            background: "var(--cb-surface-sunken, rgba(0,0,0,.04))",
            border: "1px solid var(--cb-hairline, rgba(0,0,0,.08))",
          }}
        >
          <span className="text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
            {label}
          </span>
          <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
            {ok ? <Check size={14} style={{ color: "var(--cb-accent)" }} /> : null}
            {value}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Small "Converted" chip for the dashboard job card. */
export function CbConvertedChip() {
  return <CbBadge tone="success">Converted</CbBadge>;
}

/** Warns that further edits no longer flow into the GlobalContractor job. */
export function CbConvertedNotice({ jobId }: { jobId: string }) {
  const { data: gate } = useCbCanConvert(jobId);
  if (gate?.reason !== "already_converted") return null;
  return (
    <div
      className="rounded-[14px] px-4 py-3 text-[13px]"
      style={{
        background: "var(--cb-surface-sunken, rgba(0,0,0,.05))",
        border: "1px solid var(--cb-hairline, rgba(0,0,0,.12))",
        color: "var(--cb-text-muted)",
      }}
      role="status"
    >
      This inspection already exists as a job in {gate.gc_company_name ?? "GlobalContractor"}. Edits made
      here from now on stay in Claim Buddy — update the GlobalContractor job directly.
    </div>
  );
}
