/**
 * Lead stages for the Claim Buddy tracker.
 *
 * These are the six values the `cb_jobs.status` CHECK constraint allows —
 * nothing else will insert. Labels and colours live here so the leads list,
 * the lead file and the old dashboard cannot drift apart.
 */

export type CbLeadStage =
  | "draft"
  | "inspecting"
  | "report_ready"
  | "presented"
  | "signed"
  | "converted";

export interface CbStageMeta {
  value: CbLeadStage;
  label: string;
  /** What the rep is waiting on at this stage. */
  sub: string;
  color: string;
}

export const CB_LEAD_STAGES: CbStageMeta[] = [
  { value: "draft", label: "Draft", sub: "not started", color: "#94a3b8" },
  { value: "inspecting", label: "Inspecting", sub: "on the roof", color: "#0369a1" },
  { value: "report_ready", label: "Report ready", sub: "waiting to present", color: "#15803d" },
  { value: "presented", label: "Presented", sub: "with the owner", color: "#a97a41" },
  { value: "signed", label: "Signed", sub: "paperwork in", color: "#7c3aed" },
  { value: "converted", label: "Converted", sub: "job created", color: "#15803d" },
];

const FALLBACK: CbStageMeta = {
  value: "draft",
  label: "Draft",
  sub: "not started",
  color: "#94a3b8",
};

export function cbStageOf(status: string | null | undefined): CbStageMeta {
  return CB_LEAD_STAGES.find((s) => s.value === status) ?? FALLBACK;
}

/** The next stage a rep would move this lead to, and what to call the button. */
export function cbNextStage(status: string | null | undefined): {
  label: string;
  next: CbLeadStage | null;
} {
  switch (status) {
    case "draft":
      return { label: "Start inspection", next: "inspecting" };
    case "inspecting":
      return { label: "Build report", next: "report_ready" };
    case "report_ready":
      return { label: "Present to owner", next: "presented" };
    case "presented":
      return { label: "Mark signed", next: "signed" };
    case "signed":
      return { label: "Convert to job", next: "converted" };
    default:
      return { label: "Open job", next: null };
  }
}

/** The columns the leads list and the lead file both read off cb_jobs. */
export interface CbLeadRow {
  id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  status: string | null;
  carrier: string | null;
  claim_number: string | null;
  date_of_loss: string | null;
  deductible: number | null;
  updated_at: string;
  created_at: string;
}
