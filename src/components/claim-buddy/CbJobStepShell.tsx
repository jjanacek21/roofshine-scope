import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CbProgressRail } from "@/components/cb/forms";
import { CbButton } from "@/components/cb/primitives";
import { useCbUploadQueue } from "@/lib/cbPhotoQueue";
import { useCbPendingEdits } from "@/lib/cbOfflineQueue";

export const CB_JOB_STEPS = ["Customer", "Cover photo", "Inspection"];

/** Persistent pill: nothing is ever lost, and the rep can see it draining. */
export function CbPendingPill() {
  const { pending, online } = useCbUploadQueue();
  const edits = useCbPendingEdits();
  const total = pending + edits;
  if (total === 0 && online) return null;
  return (
    <div className="cb-pending-pill" role="status" aria-live="polite">
      <span className="cb-pending-dot" aria-hidden />
      {total > 0
        ? `${total} ${total === 1 ? "item" : "items"} pending${online ? "" : " — offline"}`
        : "Offline — work is saved on this device"}
    </div>
  );
}

export function CbJobStepShell({
  step,
  jobId,
  title,
  subtitle,
  children,
}: {
  step: number;
  jobId: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen px-4 pb-28 pt-6" style={{ background: "var(--cb-bg)" }}>
      <div className="mx-auto w-full max-w-[620px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <CbProgressRail steps={CB_JOB_STEPS} current={step} />
        </div>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="cb-display" style={{ fontSize: 24, margin: 0 }}>
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
                {subtitle}
              </p>
            ) : null}
          </div>
          <CbButton
            size="md"
            variant="ghost"
            onClick={() => navigate({ to: "/cb" })}
            aria-label="Save and exit"
          >
            Save &amp; exit
          </CbButton>
        </div>
        {children}
        <p className="mt-6 cb-num text-[11px]" style={{ color: "var(--cb-text-muted)" }}>
          Job {jobId.slice(0, 8)}
        </p>
      </div>
      <CbPendingPill />
    </div>
  );
}
