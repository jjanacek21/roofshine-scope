import { supabase } from "@/integrations/supabase/client";

/**
 * A narrow, typed door onto the permit tables.
 *
 * src/integrations/supabase/types.ts is generated and gets rewritten whenever
 * the schema is regenerated, so hand-editing it to add the permit tables would
 * be undone without warning. Instead every permit query goes through this file,
 * which casts once and hands back a builder shaped like the queries we actually
 * make. If a table name here is wrong, it is wrong in exactly one place.
 */

interface Filterable<T> extends PromiseLike<{ data: T[] | null; error: unknown }> {
  eq(col: string, val: unknown): Filterable<T>;
  in(col: string, vals: unknown[]): Filterable<T>;
  is(col: string, val: unknown): Filterable<T>;
  order(col: string, opts?: { ascending?: boolean }): Filterable<T>;
  limit(n: number): Filterable<T>;
  maybeSingle(): PromiseLike<{ data: T | null; error: unknown }>;
  single(): PromiseLike<{ data: T | null; error: unknown }>;
}

interface Mutation<T> extends PromiseLike<{ data: T[] | null; error: unknown }> {
  eq(col: string, val: unknown): Mutation<T>;
  select(cols?: string): Filterable<T>;
}

interface Table<T> {
  select(cols?: string): Filterable<T>;
  insert(rows: unknown): Mutation<T>;
  update(patch: unknown): Mutation<T>;
  upsert(rows: unknown, opts?: { onConflict?: string }): Mutation<T>;
  delete(): Mutation<T>;
}

function table<T>(name: string): Table<T> {
  return (supabase as unknown as { from(t: string): Table<T> }).from(name);
}

/* ── reference data, the same for every company ── */

export interface PermitDepartment {
  id: string;
  name: string;
  jurisdiction_type: string | null;
  county: string | null;
  city: string | null;
  website: string | null;
  portal_url: string | null;
  submission_method: string | null;
  zip_codes: string[] | null;
  is_hvhz: boolean;
}

export interface PermitRequiredDoc {
  id: string;
  building_dept_id: string;
  trade_type: string;
  document_name: string;
  is_required: boolean;
  notes: string | null;
  sort_order: number;
}

export interface PermitFormTemplate {
  id: string;
  building_dept_id: string | null;
  jurisdiction_name: string | null;
  county: string | null;
  form_type: string;
  form_name: string;
  file_path: string;
  field_mapping: {
    version?: number;
    text?: Record<string, string>;
    checks?: Record<string, string>;
    overflow?: Record<string, { into: string; chars: number }>;
  };
  fill_method: "acroform" | "stamp" | "manual";
  is_fillable: boolean;
  requires_notary: boolean;
  instructions: string | null;
  notes: string | null;
}

export interface ProductApproval {
  id: string;
  manufacturer: string | null;
  product_name: string | null;
  product_category: string | null;
  noa_number: string | null;
  fl_product_approval: string | null;
  expiration_date: string | null;
  hvhz_approved: boolean;
  noa_pdf_url: string | null;
  fl_approval_pdf_url: string | null;
  file_url: string | null;
}

/* ── per-company and per-job ── */

export interface CompanyCredential {
  id: string;
  company_id: string;
  kind:
    | "qualifier_license"
    | "general_liability"
    | "workers_comp"
    | "workers_comp_exemption"
    | "business_tax_receipt"
    | "w9"
    | "surety_bond"
    | "other";
  label: string | null;
  holder_name: string | null;
  number: string | null;
  issuer: string | null;
  issued_on: string | null;
  expires_on: string | null;
  bucket: string;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  is_primary: boolean;
}

export interface JobPermit {
  id: string;
  job_id: string;
  company_id: string;
  building_dept_id: string | null;
  status: "draft" | "assembling" | "ready_to_submit" | "submitted" | "issued" | "rejected";
  folio_number: string | null;
  legal_description: string | null;
  valuation: number | null;
  work_type: string | null;
  permit_number: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  owner_address: string | null;
  owner_city: string | null;
  owner_state: string | null;
  owner_zip: string | null;
  lender_name: string | null;
  lender_address: string | null;
  surety_name: string | null;
  notes: string | null;
}

export interface JobPermitProduct {
  id: string;
  permit_id: string;
  product_approval_id: string;
  role: "roof_covering" | "underlayment" | "fastener" | "adhesive" | "accessory" | "other";
  sort_order: number;
}

export interface JobPermitDocument {
  id: string;
  permit_id: string;
  company_id: string;
  doc_key: string;
  title: string | null;
  origin: "generated" | "uploaded" | "pulled";
  bucket: string;
  storage_path: string;
  file_name: string | null;
  status: "draft" | "needs_signature" | "needs_recording" | "provided" | "rejected";
  notes: string | null;
  created_at: string;
}

export const permitDepartments = () => table<PermitDepartment>("permit_building_departments");
export const permitRequiredDocs = () => table<PermitRequiredDoc>("permit_required_documents");
export const permitFormTemplates = () => table<PermitFormTemplate>("permit_form_templates");
export const productApprovals = () => table<ProductApproval>("product_approvals");
export const companyCredentials = () => table<CompanyCredential>("company_credentials");
export const jobPermits = () => table<JobPermit>("job_permits");
export const jobPermitProducts = () => table<JobPermitProduct>("job_permit_products");
export const jobPermitDocuments = () => table<JobPermitDocument>("job_permit_documents");

/** Whichever PDF the county will accept for this approval. */
export function approvalPdfUrl(p: ProductApproval): string | null {
  return p.noa_pdf_url || p.fl_approval_pdf_url || p.file_url || null;
}

/** How this approval is referred to on the application. */
export function approvalLabel(p: ProductApproval): string {
  const num = p.noa_number || p.fl_product_approval || "";
  const name = [p.manufacturer, p.product_name].filter(Boolean).join(" ");
  return num ? `${name} — ${num}` : name || "Product approval";
}
