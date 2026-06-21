export type RKStatus = "new" | "dispatched" | "field" | "ready" | "invoiced";

export const RK_STATUSES: RKStatus[] = ["new", "dispatched", "field", "ready", "invoiced"];

export const RK_STATUS_LABELS: Record<RKStatus, string> = {
  new: "New",
  dispatched: "Dispatched",
  field: "Field Report",
  ready: "Ready for Invoice",
  invoiced: "Invoiced",
};

export const RK_STATUS_COLORS: Record<RKStatus, string> = {
  new: "#6b7888",
  dispatched: "#2f81f7",
  field: "#a06bff",
  ready: "#f0a73a",
  invoiced: "#2ec27e",
};

export const RK_PURPOSES = ["Maintenance", "Warranty", "Repair", "Emergency"] as const;
export type RKPurpose = (typeof RK_PURPOSES)[number];

export type RKMaterial = { desc: string; qty: number; cost: number };
export type RKLabor = { name: string; start?: string; stop?: string; total: number };

export type RKAccount = {
  id: string;
  company_id: string;
  name: string;
  primary_contact: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  created_at: string;
  updated_at: string;
};

export type RKProperty = {
  id: string;
  company_id: string;
  account_id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  roof_type: string | null;
  created_at: string;
  updated_at: string;
};

export type RKTicket = {
  id: string;
  company_id: string;
  property_id: string;
  account_id: string;
  wo_number: number | null;
  contact: string | null;
  phone: string | null;
  roof_type: string | null;
  service_date: string | null;
  status: RKStatus;
  purpose: string[];
  reported_concern: string | null;
  field_notes_raw: string | null;
  report_polished: string | null;
  materials: RKMaterial[];
  labor: RKLabor[];
  price: number | null;
  completed: boolean;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  invoice: RKInvoice | null;
};

export type RKInvoiceLine = {
  desc: string;
  qty: number;
  price: number;
  notes?: string;
};

export type RKInvoice = {
  invoice_number: string;
  issue_date: string;
  due_date: string;
  bill_to: { name: string; contact: string; phone: string; email: string; address: string };
  property: { name: string; address: string };
  description: string;
  lines: RKInvoiceLine[];
  tax_pct: number;
  notes: string;
};

export type RKFormField = {
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "checkbox";
  options?: string[];
};

export type RKFormTemplate = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  fields: RKFormField[];
  is_custom: boolean;
  created_at: string;
  updated_at: string;
};
