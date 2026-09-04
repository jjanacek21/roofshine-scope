import { packetStructures, type PacketStructureRow } from "./db";

/**
 * What a finished packet looks like in this jurisdiction.
 *
 * The checklist answers "what is missing". This answers the different and more
 * useful question: what does the counter expect to be handed, in what order.
 * A packet with every document present but the city supplement at the front
 * still comes back across the counter.
 *
 * The manifests are shared reference data, not per-company. One company
 * learning that Margate wants its supplement last is worth nothing if the next
 * company has to learn it again — same reasoning as the product approval
 * library.
 */

export type DocSource =
  /** The app draws it. */
  | "generated"
  /** The app fills a county form from the job; a human signs it. */
  | "auto_fill"
  /** The app pulls it from somewhere the company already keeps it. */
  | "auto_source"
  /** Only the contractor can supply it. */
  | "user_upload"
  /** A city form a company owner has taught the app. */
  | "city_specific"
  /** Included only when its condition fires. */
  | "conditional";

export interface StructureDoc {
  order?: number;
  type: string;
  source: DocSource;
  pages?: number;
  needs_signature?: boolean;
  needs_notary?: boolean;
  requires_recording?: boolean;
  condition?: string;
  product_category?: string;
  sections?: string[];
  [k: string]: unknown;
}

export interface PacketStructure {
  id: string;
  county: string;
  city: string | null;
  trade_type: string;
  material_type: string | null;
  is_hvhz: boolean;
  document_structure: StructureDoc[];
  conditional_documents: StructureDoc[] | null;
  signature_requirements: Record<string, string | string[]> | null;
  recording_requirements: Record<string, string> | null;
  notes: string | null;
}

/**
 * Human names for the document types the manifests use. A packet whose index
 * reads `hvhz_section_d` is not a packet a plans examiner can follow.
 */
export const DOC_NAMES: Record<string, string> = {
  cover_sheet: "Cover Sheet",
  permit_application: "Permit Application",
  noc: "Notice of Commencement",
  owner_authorization: "Owner Authorization Letter",
  owner_notification: "Owner Notification",
  signed_contract: "Signed Contract",
  contractor_license: "Contractor License",
  coi: "Certificate of Insurance",
  workers_comp: "Workers Compensation",
  product_approvals: "Product Approvals",
  roofing_material_fpa: "Roof Covering Product Approval",
  underlayment_fpa: "Underlayment Product Approval",
  underlayment_pe_evaluation: "Underlayment PE Evaluation",
  underlayment_options: "Underlayment Options",
  skylight_noa: "Skylight Product Approval",
  impact_test_report: "Impact Test Report",
  fastening_patterns: "Fastening Patterns",
  compliance_statement: "Compliance Statement",
  roof_layout: "Roof Layout / Diagram",
  measurement_report: "Measurement Report",
  site_photos: "Photos of Existing Roof",
  section_1524: "Section 1524 Disclosure",
  hvhz_section_d: "HVHZ Roofing Application (Section D)",
  roof_to_wall_affidavit: "Roof-to-Wall Connection Affidavit",
  roof_to_wall_mitigation: "Roof-to-Wall Mitigation Form",
  hoa_affidavit: "HOA Affidavit",
  energy_calculations: "Energy Calculations",
  engineering_drawings: "Engineering Drawings",
  property_appraiser_summary: "Property Appraiser Summary",
  city_supplement: "City Supplement",
  change_of_plan: "Change of Plan",
  form_100_shingle: "Form 100 (Shingle)",
  form_300_metal: "Form 300 (Metal)",
};

export function docName(type: string): string {
  return (
    DOC_NAMES[type] ??
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function coerce(row: PacketStructureRow): PacketStructure {
  const arr = (v: unknown): StructureDoc[] | null =>
    Array.isArray(v) ? (v as StructureDoc[]) : null;
  return {
    ...row,
    document_structure: (arr(row.document_structure) ?? []).sort(
      (a, b) => (a.order ?? 99) - (b.order ?? 99),
    ),
    conditional_documents: arr(row.conditional_documents),
  };
}

const COLS =
  "id, county, city, trade_type, material_type, is_hvhz, document_structure, conditional_documents, signature_requirements, recording_requirements, notes";

/**
 * The manifest for this job, from most specific to least.
 *
 * City-and-material beats city, which beats county-and-material, which beats
 * county. That order is not arbitrary: Boca Raton wants a PE evaluation behind
 * the metal underlayment approval that no other Palm Beach counter asks for,
 * and falling back to the county manifest there would produce a packet that
 * gets rejected in exactly one city.
 *
 * Returns null when the jurisdiction has not been mapped. That is an honest
 * answer — the caller falls back to the checklist rather than inventing an
 * order, because a confidently wrong manifest is worse than none.
 */
export async function resolvePacketStructure(opts: {
  county: string | null;
  city?: string | null;
  trade?: string;
  material?: string | null;
}): Promise<PacketStructure | null> {
  if (!opts.county) return null;
  const trade = opts.trade ?? "roofing";
  const county = opts.county;
  const city = opts.city ?? null;
  const material = opts.material ?? null;

  const q = () =>
    packetStructures()
      .select(COLS)
      .eq("is_active", true)
      .eq("county", county)
      .eq("trade_type", trade);

  type Attempt = () => PromiseLike<{ data: PacketStructureRow[] | null }>;
  const tries: Attempt[] = [];
  if (city && material) tries.push(() => q().eq("city", city).eq("material_type", material).limit(1));
  if (city) tries.push(() => q().eq("city", city).is("material_type", null).limit(1));
  if (material) tries.push(() => q().is("city", null).eq("material_type", material).limit(1));
  tries.push(() => q().is("city", null).is("material_type", null).limit(1));

  for (const attempt of tries) {
    try {
      const { data } = await attempt();
      if (data?.[0]) return coerce(data[0]);
    } catch {
      /* A missing table or a policy change should degrade to the checklist,
         not take the permit tab down. */
    }
  }
  return null;
}

/**
 * Whether a conditional document applies to this job.
 *
 * Every condition here is a fact about the building or the contract, never a
 * judgement. Where the job cannot answer — no year built on file, no valuation
 * — the answer is `null`, which the planner surfaces as "confirm this" rather
 * than quietly dropping a document the county may well require.
 */
export function evaluateCondition(
  condition: string | undefined,
  facts: {
    yearBuilt?: number | null;
    valuation?: number | null;
    hasHoa?: boolean | null;
    hasSkylights?: boolean | null;
    stories?: number | null;
    isMultifamily?: boolean | null;
  },
): boolean | null {
  if (!condition) return true;
  const { yearBuilt, valuation, hasHoa, hasSkylights } = facts;
  const before = (y: number) => (yearBuilt == null ? null : yearBuilt < y);
  const over = (n: number) => (valuation == null ? null : valuation > n);
  const both = (a: boolean | null, b: boolean | null) =>
    a === null || b === null ? null : a && b;
  const either = (a: boolean | null, b: boolean | null) =>
    a === true || b === true ? true : a === null || b === null ? null : false;

  switch (condition) {
    case "if_hoa":
      return hasHoa ?? null;
    case "if_skylights":
      return hasSkylights ?? null;
    case "if_pre_1988":
      return before(1988);
    case "if_pre_1994":
      return before(1994);
    case "if_pre_2002":
      return before(2002);
    case "if_over_300k":
      return over(300_000);
    case "if_pre_1988_and_over_300k":
      return both(before(1988), over(300_000));
    case "if_pre_1994_or_over_300k":
      return either(before(1994), over(300_000));
    case "if_over_30ft_or_multifamily":
      return either(
        facts.stories == null ? null : facts.stories > 2,
        facts.isMultifamily ?? null,
      );
    case "if_change_of_plan":
      return false;
    default:
      /* An unrecognised condition is included and flagged, never dropped. A
         document the county asked for is not something to guess away. */
      return null;
  }
}
