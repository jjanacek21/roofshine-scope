import { supabase } from "@/integrations/supabase/client";

/**
 * Browser-side reader for the shared permit reference library.
 *
 * Everything goes through `/api/permit-reference`, which holds the only key
 * that can read it. The same question is only asked once per page load: the
 * promise is memoised on the query string, so ten components mounting at once
 * make one request between them.
 */

const memo = new Map<string, Promise<unknown>>();

export function clearReferenceCache() {
  memo.clear();
}

async function get<T>(
  resource: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<T[]> {
  const sp = new URLSearchParams({ resource });
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const key = sp.toString();

  const existing = memo.get(key);
  if (existing) return existing as Promise<T[]>;

  const run = (async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sign in to read the permit library.");

    const res = await fetch(`/api/permit-reference?${key}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      let body: { error?: string } | null = null;
      try {
        body = (await res.json()) as { error?: string };
      } catch {
        body = null;
      }
      throw new Error(body?.error ?? `Permit library unavailable (${res.status})`);
    }
    const body = (await res.json()) as { rows?: T[] };
    return body.rows ?? [];
  })();

  memo.set(key, run);
  run.catch(() => memo.delete(key));
  return run;
}

/* ── shapes ── */

export interface RefDepartment {
  id: string;
  name: string;
  jurisdiction_type: string | null;
  county: string | null;
  city: string | null;
  website: string | null;
  portal_url: string | null;
  submission_method: string | null;
  processing_time: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  hours: string | null;
  zip_codes: string[] | null;
  is_hvhz: boolean;
  notes: string | null;
}

export interface RefFormTemplate {
  id: string;
  building_dept_id: string | null;
  jurisdiction_name: string | null;
  county: string | null;
  city: string | null;
  form_type: string | null;
  form_name: string;
  form_version: string | null;
  trade_types: string[] | null;
  file_path: string | null;
  field_mapping: unknown | null;
  is_fillable: boolean;
  field_count: number | null;
  requires_signature: boolean;
  requires_notary: boolean;
  notary_threshold: number | null;
  page_count: number | null;
  hvhz_only: boolean;
  instructions: string | null;
  common_errors: string[] | null;
  analysis_status: string | null;
  notes: string | null;
  /** Added by the server from `file_path`. */
  form_url: string | null;
}

export interface RefFieldMapping {
  id: string;
  template_id: string;
  our_field: string;
  pdf_field: string;
  field_type: string | null;
  is_required: boolean;
  page_number: number | null;
  default_value: string | null;
  transform_function: string | null;
  transform_type: string | null;
  section: string | null;
  conditional_logic: unknown | null;
  validation_pattern: string | null;
  notes: string | null;
}

export interface RefDepartmentRule {
  id: string;
  building_department_id: string | null;
  county: string | null;
  city: string | null;
  rule_type: string | null;
  permit_types: string[] | null;
  rule_description: string | null;
  rule_action: string | null;
  document_required: string | null;
  is_active: boolean;
  priority: number | null;
}

export interface RefRequiredDoc {
  id: string;
  building_dept_id: string | null;
  trade_type: string | null;
  document_name: string;
  document_url: string | null;
  is_required: boolean;
  notes: string | null;
  sort_order: number | null;
}

export interface RefFastenerPattern {
  id: string;
  jurisdiction_county: string | null;
  jurisdiction_city: string | null;
  is_hvhz: boolean;
  zone_type: string | null;
  roof_material: string | null;
  deck_type: string | null;
  fastener_for: string | null;
  nail_type: string | null;
  nail_length: string | null;
  nail_gauge: string | null;
  spacing_inches: number | null;
  spacing_description: string | null;
  nails_per_square: number | null;
  source_document: string | null;
  source_page: number | null;
  notes: string | null;
}

export interface RefInspectionStep {
  id: string;
  inspection_type: string;
  inspection_code: string | null;
  category: string | null;
  description: string | null;
  is_required: boolean;
  order_in_sequence: number | null;
  prerequisites: string[] | null;
}

export interface RefApproval {
  id: string;
  manufacturer: string | null;
  product_name: string | null;
  product_line: string | null;
  product_category: string | null;
  noa_number: string | null;
  fl_product_approval: string | null;
  approval_date: string | null;
  expiration_date: string | null;
  hvhz_approved: boolean;
  applicable_trades: string[] | null;
  wind_speed_rating: number | null;
  noa_pdf_url: string | null;
  fl_approval_pdf_url: string | null;
  ul_listing_url: string | null;
  installation_guide_url: string | null;
  file_url: string | null;
}

/* ── thin wrappers ── */

export const refDepartments = (p: {
  county?: string;
  city?: string;
  jurisdiction_type?: string;
  hvhz?: boolean;
  limit?: number;
} = {}) => get<RefDepartment>("departments", p);

export const refRequiredDocuments = (p: {
  building_dept_id?: string;
  trade_type?: string;
  limit?: number;
} = {}) => get<RefRequiredDoc>("required_documents", p);

export const refFormTemplates = (p: {
  building_dept_id?: string;
  county?: string;
  city?: string;
  form_type?: string;
  fillable?: boolean;
  limit?: number;
} = {}) => get<RefFormTemplate>("form_templates", p);

export const refFieldMappings = (templateId: string) =>
  get<RefFieldMapping>("field_mappings", { template_id: templateId });

export const refDepartmentRules = (p: {
  building_department_id?: string;
  county?: string;
  city?: string;
  rule_type?: string;
  limit?: number;
} = {}) => get<RefDepartmentRule>("department_rules", p);

export const refInspectionSequence = (p: {
  category?: string;
  inspection_type?: string;
  limit?: number;
} = {}) => get<RefInspectionStep>("inspections", p);

export const refFastenerPatterns = (p: {
  county?: string;
  city?: string;
  roof_material?: string;
  zone_type?: string;
  deck_type?: string;
  hvhz?: boolean;
  limit?: number;
} = {}) => get<RefFastenerPattern>("fastener_patterns", p);

export const refApprovals = (p: {
  category?: string;
  manufacturer?: string;
  q?: string;
  hvhz?: boolean;
  limit?: number;
} = {}) => get<RefApproval>("approvals", p);

/**
 * Every rule that touches this job, narrowest scope first: the department's
 * own rules, then the city's, then the county's.
 */
export async function rulesForJob(dept: {
  id?: string | null;
  county?: string | null;
  city?: string | null;
}): Promise<RefDepartmentRule[]> {
  const [byDept, byCity, byCounty] = await Promise.all([
    dept.id ? refDepartmentRules({ building_department_id: dept.id }) : Promise.resolve([]),
    dept.city ? refDepartmentRules({ city: dept.city }) : Promise.resolve([]),
    dept.county ? refDepartmentRules({ county: dept.county }) : Promise.resolve([]),
  ]);

  const seen = new Set<string>();
  const out: RefDepartmentRule[] = [];
  for (const r of [...byDept, ...byCity, ...byCounty]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}

export interface FasteningSchedule {
  corner: RefFastenerPattern[];
  perimeter: RefFastenerPattern[];
  field: RefFastenerPattern[];
  general: RefFastenerPattern[];
}

/** Fastener patterns bucketed by roof zone. */
export async function fasteningSchedule(p: {
  county?: string | null;
  city?: string | null;
  roofMaterial?: string | null;
  hvhz?: boolean;
}): Promise<FasteningSchedule> {
  const rows = await refFastenerPatterns({
    county: p.county ?? undefined,
    city: p.city ?? undefined,
    roof_material: p.roofMaterial ?? undefined,
    hvhz: p.hvhz ? true : undefined,
  });

  const out: FasteningSchedule = { corner: [], perimeter: [], field: [], general: [] };
  for (const r of rows) {
    const zone = (r.zone_type ?? "").toLowerCase();
    if (zone.includes("corner")) out.corner.push(r);
    else if (zone.includes("perimeter")) out.perimeter.push(r);
    else if (zone.includes("field")) out.field.push(r);
    else out.general.push(r);
  }
  return out;
}
