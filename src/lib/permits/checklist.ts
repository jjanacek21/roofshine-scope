import { permitRequiredDocs, type JobPermitDocument } from "./db";
import type { PermitContext } from "./context";

/**
 * What this permit packet still needs, and who has to do something about it.
 *
 * The checklist is READ from what the building department published, never
 * invented, because guessing wrong means a rejection weeks later. Where a
 * department has not published a list yet we fall back to the items every
 * Florida counter asks for — and even where it has, those core items are merged
 * in, because several of the published lists omit licence, insurance and
 * workers comp and every counter asks for them anyway.
 *
 * The useful part is not the list but the resolution: each requirement is
 * matched against what the job, the company and the product library already
 * hold, so the only things left on screen are the ones a human still has to do.
 */

export type Fulfilment =
  /** We fill it and hand it back to print and sign. */
  | "generated"
  /** We pull it from somewhere the company already keeps it. */
  | "auto_sourced"
  /** Only the contractor can supply it. */
  | "upload";

export type SatisfiedBy =
  | "company credentials"
  | "the signed contract on this job"
  | "the measurement on this job"
  | "the product approval library"
  | "uploaded"
  | null;

export interface Requirement {
  key: string;
  name: string;
  required: boolean;
  fulfilment: Fulfilment;
  instruction: string;
  satisfied: boolean;
  satisfiedBy: SatisfiedBy;
  /** Set when the thing satisfying it has expired or is about to. */
  warning?: string;
}

export interface PacketState {
  jurisdiction: string | null;
  source: "jurisdiction" | "florida_baseline";
  requirements: Requirement[];
  /** What the contractor has to go and do, in the order they would do it. */
  todo: Requirement[];
  /** What the app takes care of, shown so they stop chasing it. */
  handled: Requirement[];
  completion: number;
  ready: boolean;
}

interface Rule {
  match: RegExp;
  key: string;
  how: Fulfilment;
  instruction: string;
}

/**
 * Keyed on words that appear in the department's own document_name. First match
 * wins, so narrow patterns sit above broad ones — "workers comp" has to be
 * tested before the bare word "insurance".
 */
const RULES: Rule[] = [
  {
    match: /notice of commencement|\bnoc\b/i,
    key: "noc",
    how: "generated",
    instruction:
      "We fill this from the job. Print it, have the owner sign before a notary, record it with the county Clerk, then upload the recorded copy.",
  },
  {
    match: /permit application/i,
    key: "permit_application",
    how: "generated",
    instruction:
      "We fill this from the job. Print it, have the qualifier and owner sign, then upload the signed copy.",
  },
  {
    match: /workers.?comp/i,
    key: "workers_comp",
    how: "auto_sourced",
    instruction: "Pulled from company credentials. Add it there if it is missing.",
  },
  {
    match: /qualifier license|\bccc\b|\bcgc\b|license/i,
    key: "qualifier_license",
    how: "auto_sourced",
    instruction: "Pulled from company credentials. Add it there if it is missing.",
  },
  {
    match: /liability|insurance|\bcoi\b/i,
    key: "insurance",
    how: "auto_sourced",
    instruction: "Pulled from company credentials. Add it there if it is missing.",
  },
  {
    match: /affidavit/i,
    key: "product_approval_affidavit",
    how: "generated",
    instruction: "We fill this from the products on the job. Print, sign, and upload it.",
  },
  {
    match: /noa|product approval/i,
    key: "product_approval",
    how: "auto_sourced",
    instruction: "Pulled from the product approval library using the products on this job.",
  },
  {
    match: /contract/i,
    key: "signed_contract",
    how: "auto_sourced",
    instruction: "Taken from the signed contract on this job.",
  },
  {
    match: /roof layout|measurement|diagram/i,
    key: "roof_layout",
    how: "auto_sourced",
    instruction: "Taken from the measurement on this job.",
  },
  {
    match: /wind mitigation/i,
    key: "wind_mitigation",
    how: "upload",
    instruction: "Upload the completed wind mitigation form.",
  },
  {
    match: /asbestos/i,
    key: "asbestos_survey",
    how: "upload",
    instruction: "Required on older structures. Upload the survey.",
  },
  {
    match: /hoa|architectural/i,
    key: "hoa_approval",
    how: "upload",
    instruction: "Upload the HOA or architectural review approval letter.",
  },
  {
    match: /photo/i,
    key: "photos",
    how: "upload",
    instruction: "Upload photos of the existing roof.",
  },
  {
    match: /spec sheet/i,
    key: "spec_sheet",
    how: "auto_sourced",
    instruction: "Pulled from the product approval library where the manufacturer publishes it.",
  },
];

/** Required on every Florida job whatever a department bothered to publish. */
const CORE = [
  "Permit Application",
  "Notice of Commencement (NOC)",
  "Qualifier License (CCC/CGC)",
  "General Liability Insurance",
  "Workers Compensation",
  "Signed Contract",
];

const BASELINE = [...CORE, "Florida Product Approval / NOA"];

/** Uploads made under an older or shorter type name still count. */
const ALIASES: Record<string, string> = {
  notice_of_commencement: "noc",
  permit_app: "permit_application",
  permit_application_unsigned: "permit_application",
  application: "permit_application",
  license: "qualifier_license",
  contractor_license: "qualifier_license",
  coi: "insurance",
  general_liability: "insurance",
  liability_insurance: "insurance",
  workers_compensation: "workers_comp",
  contract: "signed_contract",
  noa: "product_approval",
  measurement: "roof_layout",
  measurement_report: "roof_layout",
  asbestos: "asbestos_survey",
  hoa: "hoa_approval",
};

function classify(name: string): Rule {
  for (const r of RULES) if (r.match.test(name)) return r;
  return {
    match: /$^/,
    key: name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40),
    how: "upload",
    instruction: "Upload this document.",
  };
}

function normalizeKey(t: string): string {
  const raw = String(t ?? "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_");
  return ALIASES[raw] ?? raw;
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.floor(ms / 86_400_000);
}

export async function buildPacketState(
  ctx: PermitContext,
  uploaded: JobPermitDocument[],
): Promise<PacketState> {
  let deptDocs: { document_name: string; is_required: boolean; notes: string | null }[] = [];
  if (ctx.department?.id) {
    const { data } = await permitRequiredDocs()
      .select("document_name, is_required, notes, sort_order")
      .eq("building_dept_id", ctx.department.id)
      .eq("trade_type", "roofing")
      .order("sort_order");
    deptDocs = (data ?? []) as typeof deptDocs;
  }

  const usingBaseline = deptDocs.length === 0;
  if (usingBaseline) {
    deptDocs = BASELINE.map((d) => ({ document_name: d, is_required: true, notes: null }));
  } else {
    const present = new Set(deptDocs.map((d) => classify(d.document_name).key));
    for (const name of CORE) {
      if (!present.has(classify(name).key)) {
        deptDocs.push({ document_name: name, is_required: true, notes: null });
      }
    }
  }

  const have = new Set(uploaded.map((d) => normalizeKey(d.doc_key)));

  /* What the rest of the app can already answer for. */
  const credentialFor = (kind: string) => ctx.credentials.find((c) => c.kind === kind);
  const licence = credentialFor("qualifier_license");
  const liability = credentialFor("general_liability");
  const comp = credentialFor("workers_comp") ?? credentialFor("workers_comp_exemption");
  /* A product approval only satisfies the requirement if it is still current
     and, inside the HVHZ, actually HVHZ-approved. One attached row used to
     satisfy every product requirement on the packet regardless of either. */
  const hvhz = !!ctx.department?.is_hvhz;
  const usableProducts = ctx.products.filter((p) => {
    if (hvhz && !p.hvhz_approved) return false;
    if (!p.expiration_date) return true;
    return new Date(p.expiration_date).getTime() >= new Date(new Date().toDateString()).getTime();
  });
  const lapsedProducts = ctx.products.length - usableProducts.length;
  /* The counter wants the covering and what goes under it at minimum. */
  const roles = new Set(usableProducts.map((p) => p.role));
  const hasProducts = usableProducts.length > 0;
  const coversRoof = roles.has("roof_covering");

  const seen = new Set<string>();
  const requirements: Requirement[] = [];

  for (const d of deptDocs) {
    const rule = classify(d.document_name);
    if (seen.has(rule.key)) continue;
    seen.add(rule.key);

    let satisfied = have.has(rule.key);
    let satisfiedBy: SatisfiedBy = satisfied ? "uploaded" : null;
    let warning: string | undefined;

    if (!satisfied) {
      switch (rule.key) {
        case "qualifier_license":
        case "insurance":
        case "workers_comp": {
          const cred =
            rule.key === "qualifier_license" ? licence : rule.key === "insurance" ? liability : comp;
          if (cred?.storage_path) {
            satisfied = true;
            satisfiedBy = "company credentials";
            const left = daysUntil(cred.expires_on);
            if (left !== null && left < 0) {
              satisfied = false;
              satisfiedBy = null;
              warning = `Expired ${Math.abs(left)} days ago — the counter will reject it.`;
            } else if (left !== null && left <= 30) {
              warning = `Expires in ${left} days.`;
            }
          }
          break;
        }
        case "signed_contract":
          if (ctx.contractUrl) {
            satisfied = true;
            satisfiedBy = "the signed contract on this job";
          }
          break;
        case "roof_layout":
          if (ctx.hasMeasurement) {
            satisfied = true;
            satisfiedBy = "the measurement on this job";
          }
          break;
        case "product_approval":
        case "spec_sheet":
          if (hasProducts) {
            satisfied = true;
            satisfiedBy = "the product approval library";
            if (!coversRoof) {
              warning =
                "No roof covering approval attached — the counter will look for the shingle, tile or panel itself.";
            } else if (lapsedProducts > 0) {
              warning =
                hvhz && ctx.products.some((p) => !p.hvhz_approved)
                  ? `${lapsedProducts} attached approval${lapsedProducts === 1 ? " is" : "s are"} lapsed or not HVHZ-approved.`
                  : `${lapsedProducts} attached approval${lapsedProducts === 1 ? " has" : "s have"} expired.`;
            }
          }
          break;
        default:
          break;
      }
    }

    requirements.push({
      key: rule.key,
      name: d.document_name,
      required: d.is_required !== false,
      fulfilment: rule.how,
      instruction: d.notes || rule.instruction,
      satisfied,
      satisfiedBy,
      warning,
    });
  }

  const required = requirements.filter((r) => r.required);
  const done = required.filter((r) => r.satisfied).length;
  const fieldTotal = 11; // the count in REQUIRED over in context.ts
  const fieldsDone = Math.max(0, fieldTotal - ctx.gaps.length);
  const denom = required.length + fieldTotal;
  const completion = denom === 0 ? 100 : Math.round(((done + fieldsDone) / denom) * 100);

  const outstanding = required.filter((r) => !r.satisfied);

  return {
    jurisdiction: ctx.department?.name ?? null,
    source: usingBaseline ? "florida_baseline" : "jurisdiction",
    requirements,
    todo: outstanding,
    handled: requirements.filter((r) => r.satisfied && r.satisfiedBy !== "uploaded"),
    completion,
    ready: outstanding.length === 0 && ctx.gaps.length === 0,
  };
}
