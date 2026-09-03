import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, ArrowRightLeft, ExternalLink } from "lucide-react";
import { useIsCompanyAdmin } from "@/hooks/useProfile";
import { convertCbJobToCrm } from "@/lib/claimbuddy/convert";

/**
 * The button that carries an inspection into the CRM.
 *
 * Once a lead has been inspected and is going to be a job, everything the CRM
 * needs is already sitting in Claim Buddy — customer, address, claim, roof
 * measurement, photos and the report. Retyping it is the step this removes.
 *
 * Only company admins see it. Creating a job writes a customer and a property
 * as a side effect, which is not something every rep should be able to do by
 * accident from an inspection screen.
 */
export function AddToCrmButton({
  cbJobId,
  alreadyJobId,
  onConverted,
}: {
  cbJobId: string;
  /** Set when this inspection has already been converted. */
  alreadyJobId?: string | null;
  onConverted?: (jobId: string) => void;
}) {
  const navigate = useNavigate();
  const isAdmin = useIsCompanyAdmin();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");

  if (!isAdmin) return null;

  if (alreadyJobId) {
    return (
      <button
        onClick={() => navigate({ to: "/jobs/$id", params: { id: alreadyJobId } })}
        className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold hover:bg-[var(--surface-hover)]"
        style={{ borderColor: "var(--border)" }}
      >
        <ExternalLink className="h-4 w-4" />
        Open the job
      </button>
    );
  }

  const run = async () => {
    setBusy(true);
    try {
      const res = await convertCbJobToCrm(cbJobId, setStep);
      const bits = [
        res.measurementCopied ? "measurement" : null,
        res.photosCopied ? `${res.photosCopied} photo${res.photosCopied === 1 ? "" : "s"}` : null,
        res.reportFiled ? "report" : null,
      ].filter(Boolean);

      if (!res.created) {
        toast.info("This inspection was already a job — opening it.");
      } else {
        toast.success(bits.length ? `Job created with the ${bits.join(", ")}.` : "Job created.");
      }
      if (res.photosFailed) {
        toast.warning(
          `${res.photosFailed} photo${res.photosFailed === 1 ? "" : "s"} could not be copied — they are still on the inspection.`,
        );
      }
      onConverted?.(res.jobId);
      navigate({ to: "/jobs/$id", params: { id: res.jobId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That inspection could not be converted.");
    } finally {
      setBusy(false);
      setStep("");
    }
  };

  return (
    <button
      onClick={() => void run()}
      disabled={busy}
      title="Create a CRM job from this inspection, with the measurement, photos and report"
      className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
      style={{ background: "var(--brand)" }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
      {busy ? step || "Converting…" : "Add to CRM"}
    </button>
  );
}
