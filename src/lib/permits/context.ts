import { supabase } from "@/integrations/supabase/client";
import {
  companyCredentials,
  jobPermitProducts,
  jobPermits,
  permitDepartments,
  productApprovals,
  type CompanyCredential,
  type JobPermit,
  type PermitDepartment,
  type ProductApproval,
} from "./db";

/**
 * Everything the county forms need, gathered from the job.
 *
 * The point of the permit tab is that a contractor should not retype what the
 * job already knows. So almost nothing here is stored on the permit: the owner
 * comes from the client, the address from the property, the roof area from the
 * measurement, the company details and licence from company settings. Only
 * folio, legal description and job valuation live on the permit record, because
 * nothing else in the app has anywhere to put them.
 *
 * Every value carries where it came from. That matters more than it looks: when
 * a form comes out wrong the first question is always "wrong where", and a
 * value that can name its own source answers it.
 */

export type SourceKey =
  | "property_address"
  | "property_city"
  | "property_state"
  | "property_zip"
  | "folio"
  | "legal_description"
  | "square_footage"
  | "valuation"
  | "scope_description"
  | "today"
  | "owner_name"
  | "owner_phone"
  | "owner_email"
  | "owner_address"
  | "owner_city"
  | "owner_state"
  | "owner_zip"
  | "contractor_company"
  | "contractor_phone"
  | "contractor_email"
  | "contractor_address"
  | "contractor_city"
  | "contractor_state"
  | "contractor_zip"
  | "qualifier_name"
  | "license_number"
  | "lender_name"
  | "lender_address"
  | "surety_name";

export type FlagKey =
  | "always"
  | "new_construction"
  | "reroof_or_repair"
  | "reroof_replacement"
  | "recover_overlay";

/** Where a value came from, in words a contractor would use. */
export type Origin =
  | "the customer on this job"
  | "the property"
  | "the measurement"
  | "the estimate"
  | "company settings"
  | "company credentials"
  | "this permit"
  | "today";

export interface Gap {
  key: SourceKey;
  label: string;
  why: string;
  /** Where the user goes to fix it. */
  fixIn: "permit" | "job" | "property" | "company" | "credentials" | "measurement";
}

export interface PermitContext {
  jobId: string;
  companyId: string;
  permit: JobPermit | null;
  department: PermitDepartment | null;
  values: Partial<Record<SourceKey, string>>;
  origins: Partial<Record<SourceKey, Origin>>;
  flags: Partial<Record<FlagKey, boolean>>;
  credentials: CompanyCredential[];
  products: (ProductApproval & { role: string })[];
  /** Things a form asks for that the job cannot answer yet. */
  gaps: Gap[];
  /** Credentials that are on file but no longer current. */
  expired: CompanyCredential[];
  /** A signed contract already on the job, if there is one. */
  contractUrl: string | null;
  /** A measurement report or roof diagram already on the job, if there is one. */
  measurementUrl: string | null;
  hasMeasurement: boolean;
}

const LABELS: Record<SourceKey, string> = {
  property_address: "Property address",
  property_city: "Property city",
  property_state: "Property state",
  property_zip: "Property ZIP",
  folio: "Folio / parcel number",
  legal_description: "Legal description",
  square_footage: "Roof area",
  valuation: "Job value",
  scope_description: "Scope of work",
  today: "Date",
  owner_name: "Owner name",
  owner_phone: "Owner phone",
  owner_email: "Owner email",
  owner_address: "Owner mailing address",
  owner_city: "Owner city",
  owner_state: "Owner state",
  owner_zip: "Owner ZIP",
  contractor_company: "Company name",
  contractor_phone: "Company phone",
  contractor_email: "Company email",
  contractor_address: "Company address",
  contractor_city: "Company city",
  contractor_state: "Company state",
  contractor_zip: "Company ZIP",
  qualifier_name: "Qualifier name",
  license_number: "Qualifier licence number",
  lender_name: "Mortgage lender",
  lender_address: "Lender address",
  surety_name: "Bonding company",
};

/** What the county will not accept a blank for, and where to go fix it. */
const REQUIRED: { key: SourceKey; why: string; fixIn: Gap["fixIn"] }[] = [
  { key: "property_address", why: "On every form, and it sets the jurisdiction.", fixIn: "property" },
  { key: "property_city", why: "Determines which department issues the permit.", fixIn: "property" },
  { key: "owner_name", why: "Goes on the application and the Notice of Commencement.", fixIn: "job" },
  { key: "folio", why: "Required on the NOC and the application.", fixIn: "permit" },
  { key: "legal_description", why: "Required on the Notice of Commencement.", fixIn: "permit" },
  { key: "valuation", why: "Sets the permit fee, and the $5,000 notary threshold.", fixIn: "permit" },
  { key: "square_footage", why: "Used for the fee calculation and the scope.", fixIn: "measurement" },
  { key: "scope_description", why: "Drives the permit type and the sub-documents.", fixIn: "permit" },
  { key: "contractor_company", why: "The company pulling the permit.", fixIn: "company" },
  { key: "qualifier_name", why: "The person qualifying the job signs the application.", fixIn: "credentials" },
  { key: "license_number", why: "Verifies eligibility to pull the permit.", fixIn: "credentials" },
];

function txt(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

function money(v: unknown): string {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || !Number.isFinite(n) || n === 0) return "";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function isExpired(c: CompanyCredential): boolean {
  if (!c.expires_on) return false;
  return new Date(c.expires_on) < new Date(new Date().toDateString());
}

/** Turn what the job says about the work into the flags a form's checkboxes use. */
export function workFlags(workType: string | null | undefined): Partial<Record<FlagKey, boolean>> {
  const w = String(workType ?? "").toLowerCase();
  const newBuild = /new[_ ]?construction/.test(w);
  const overlay = /recover|overlay/.test(w);
  const replace = /replace|tear|re-?roof/.test(w);
  const repair = /repair/.test(w);
  return {
    always: true,
    new_construction: newBuild,
    recover_overlay: overlay,
    reroof_replacement: replace,
    reroof_or_repair: !newBuild && (overlay || replace || repair),
  };
}

export async function buildPermitContext(jobId: string): Promise<PermitContext> {
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select(
      "id, company_id, client_id, property_id, name, property_address, jurisdiction, total_estimate, roof_system, notes",
    )
    .eq("id", jobId)
    .maybeSingle();
  if (jobErr) throw jobErr;
  if (!job) throw new Error("Job not found");

  const j = job as unknown as Record<string, unknown>;
  const companyId = txt(j.company_id);

  const [clientRes, propertyRes, companyRes, permitRes, credRes] = await Promise.all([
    j.client_id
      ? supabase.from("clients").select("name, email, phone, address").eq("id", j.client_id as string).maybeSingle()
      : Promise.resolve({ data: null }),
    j.property_id
      ? supabase
          .from("properties")
          .select("id, address, city, state, zip, year_built, roof_type")
          .eq("id", j.property_id as string)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("companies")
      .select("name, address, city, state, postal_code, phone, email, license_numbers")
      .eq("id", companyId)
      .maybeSingle(),
    jobPermits().select("*").eq("job_id", jobId).maybeSingle(),
    companyCredentials().select("*").eq("company_id", companyId),
  ]);

  const client = clientRes.data as Record<string, unknown> | null;
  const property = propertyRes.data as Record<string, unknown> | null;
  const company = companyRes.data as Record<string, unknown> | null;
  const permit = (permitRes.data ?? null) as JobPermit | null;
  const credentials = ((credRes.data ?? []) as CompanyCredential[]).filter((c) => c.is_primary);

  /* The measurement lives on the property, not the job, so a second lookup. */
  const measurementRes = property?.id
    ? await supabase
        .from("roof_measurements")
        .select("squares, total_area_sqft, source_file_url")
        .eq("property_id", property.id as string)
        .maybeSingle()
    : { data: null };
  const measurement = measurementRes.data as Record<string, unknown> | null;

  /* A signed contract already on the job satisfies one of the requirements. */
  const contractRes = await supabase
    .from("contracts")
    .select("pdf_url, signed_at")
    .eq("job_id", jobId)
    .order("signed_at", { ascending: false })
    .limit(1);
  const contract = ((contractRes.data ?? []) as Record<string, unknown>[])[0] ?? null;

  const department = permit?.building_dept_id
    ? (((await permitDepartments()
        .select("id, name, jurisdiction_type, county, city, website, portal_url, submission_method, zip_codes, is_hvhz")
        .eq("id", permit.building_dept_id)
        .maybeSingle()) as { data: PermitDepartment | null }).data ?? null)
    : null;

  /* The product approvals chosen for this job, with their approval records. */
  let products: (ProductApproval & { role: string })[] = [];
  if (permit?.id) {
    const { data: links } = await jobPermitProducts()
      .select("product_approval_id, role, sort_order")
      .eq("permit_id", permit.id)
      .order("sort_order");
    const ids = (links ?? []).map((l) => l.product_approval_id);
    if (ids.length) {
      const { data: approvals } = await productApprovals()
        .select(
          "id, manufacturer, product_name, product_category, noa_number, fl_product_approval, expiration_date, hvhz_approved, noa_pdf_url, fl_approval_pdf_url, file_url",
        )
        .in("id", ids);
      const byId = new Map((approvals ?? []).map((a) => [a.id, a]));
      products = (links ?? [])
        .map((l) => {
          const a = byId.get(l.product_approval_id);
          return a ? { ...a, role: l.role } : null;
        })
        .filter(Boolean) as (ProductApproval & { role: string })[];
    }
  }

  const licence = credentials.find((c) => c.kind === "qualifier_license");
  const licenceNumbers = Array.isArray(j.license_numbers) ? (j.license_numbers as string[]) : [];
  const companyLicences = Array.isArray(company?.license_numbers)
    ? (company!.license_numbers as string[])
    : licenceNumbers;

  const values: Partial<Record<SourceKey, string>> = {};
  const origins: Partial<Record<SourceKey, Origin>> = {};
  const put = (key: SourceKey, value: string, origin: Origin) => {
    if (!value) return;
    if (values[key]) return; // first source wins, and they are listed best-first
    values[key] = value;
    origins[key] = origin;
  };

  /* Property. The permit's own copy of the owner address wins over the job's,
     because a mailing address that differs from the job site is exactly why
     that field exists. */
  put("property_address", txt(property?.address) || txt(j.property_address), property?.address ? "the property" : "the customer on this job");
  put("property_city", txt(property?.city), "the property");
  put("property_state", txt(property?.state) || "FL", "the property");
  put("property_zip", txt(property?.zip), "the property");

  /* Owner. The permit record can override, for a landlord or an estate. */
  put("owner_name", txt(permit?.owner_name), "this permit");
  put("owner_name", txt(client?.name), "the customer on this job");
  put("owner_phone", txt(permit?.owner_phone) || txt(client?.phone), permit?.owner_phone ? "this permit" : "the customer on this job");
  put("owner_email", txt(permit?.owner_email) || txt(client?.email), permit?.owner_email ? "this permit" : "the customer on this job");
  put("owner_address", txt(permit?.owner_address), "this permit");
  put("owner_address", txt(client?.address) || txt(property?.address), "the customer on this job");
  put("owner_city", txt(permit?.owner_city) || txt(property?.city), permit?.owner_city ? "this permit" : "the property");
  put("owner_state", txt(permit?.owner_state) || txt(property?.state) || "FL", "the property");
  put("owner_zip", txt(permit?.owner_zip) || txt(property?.zip), permit?.owner_zip ? "this permit" : "the property");

  /* Permit-only fields. */
  put("folio", txt(permit?.folio_number), "this permit");
  put("legal_description", txt(permit?.legal_description), "this permit");
  put("valuation", money(permit?.valuation), "this permit");
  put("valuation", money(j.total_estimate), "the estimate");
  put("scope_description", txt(permit?.notes), "this permit");
  put("scope_description", txt(j.roof_system), "the estimate");

  /* Measurement. Roof area on the application is square feet, not squares. */
  const squares = Number(measurement?.squares ?? 0);
  const sqft =
    txt(measurement?.total_area_sqft) || (squares > 0 ? String(Math.round(squares * 100)) : "");
  put("square_footage", sqft, "the measurement");

  /* Company. */
  put("contractor_company", txt(company?.name), "company settings");
  put("contractor_phone", txt(company?.phone), "company settings");
  put("contractor_email", txt(company?.email), "company settings");
  put("contractor_address", txt(company?.address), "company settings");
  put("contractor_city", txt(company?.city), "company settings");
  put("contractor_state", txt(company?.state) || "FL", "company settings");
  put("contractor_zip", txt(company?.postal_code), "company settings");

  /* The qualifier and licence come from the credential, because that is the
     record that also knows when the licence stops being valid. */
  put("qualifier_name", txt(licence?.holder_name), "company credentials");
  put("license_number", txt(licence?.number), "company credentials");
  put("license_number", txt(companyLicences[0]), "company settings");

  put("lender_name", txt(permit?.lender_name), "this permit");
  put("lender_address", txt(permit?.lender_address), "this permit");
  put("surety_name", txt(permit?.surety_name), "this permit");
  put("today", new Date().toLocaleDateString("en-US"), "today");

  const gaps: Gap[] = REQUIRED.filter((r) => !values[r.key]).map((r) => ({
    key: r.key,
    label: LABELS[r.key],
    why: r.why,
    fixIn: r.fixIn,
  }));

  return {
    jobId,
    companyId,
    permit,
    department,
    values,
    origins,
    flags: workFlags(permit?.work_type),
    credentials,
    products,
    gaps,
    expired: credentials.filter(isExpired),
    contractUrl: txt(contract?.pdf_url) || null,
    measurementUrl: txt(measurement?.source_file_url) || null,
    hasMeasurement: Boolean(measurement),
  };
}

export const sourceLabel = (k: SourceKey) => LABELS[k] ?? k;
