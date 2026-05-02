// Shared types and helpers for the Lead Center.

export const LEAD_STATUSES = [
  { value: "new", label: "New", color: "#3b82f6" },
  { value: "contacted", label: "Contacted", color: "#eab308" },
  { value: "qualified", label: "Qualified", color: "#a855f7" },
  { value: "quoted", label: "Quoted", color: "#06b6d4" },
  { value: "won", label: "Won", color: "#22c55e" },
  { value: "lost", label: "Lost", color: "#ef4444" },
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]["value"];

export function leadStatusColor(status: string): string {
  return LEAD_STATUSES.find((s) => s.value === status)?.color ?? "#71717a";
}

export function leadStatusLabel(status: string): string {
  return LEAD_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export interface LeadRow {
  id: string;
  company_id: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  owner: string | null;
  sqft: number | null;
  year_built: string | null;
  lat: number | null;
  lng: number | null;
  roof_type: string | null;
  property_type: string | null;
  status: LeadStatus;
  estimated_value: number | null;
  sale_amount: string | null;
  reported_owner: string | null;
  ai_report: Record<string, unknown>;
  import_date: string;
  created_at: string;
  updated_at: string;
}

export interface LeadContact {
  id: string;
  lead_id: string;
  name: string;
  title: string | null;
  company: string | null;
  sort_order: number;
  phones?: { id: string; phone: string; phone_type: string }[];
  emails?: { id: string; email: string }[];
}

export function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

// Default South Florida fallback coordinates with small jitter
export function defaultSoFlaCoord(seed: number): { lat: number; lng: number } {
  const r = (s: number) => {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };
  return {
    lat: 25.75 + r(seed) * 0.5,
    lng: -80.5 + r(seed * 7) * 0.5,
  };
}
