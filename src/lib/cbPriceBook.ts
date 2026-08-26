/**
 * Price book, browsed the way a rep actually works.
 *
 * `searchLineItems` in cbCatalogResolve is a flat keyword search — fine when
 * you know the code, useless when you are working a roof and want everything
 * under Flashings. This module reads the same `line_item_master` table and
 * serves it as trade → sub-group → items, so the picker can let a rep open one
 * sub-group, tap every line they need, and only then move on.
 *
 * Counts come back separately from items: a rep needs to see "Flashings 86"
 * before deciding to open it, and loading 86 rows to render one number is
 * waste on a phone.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { CbCatalogLineItem } from "@/lib/cbCatalogResolve";

export type CbTrade = Database["public"]["Enums"]["trade_type"];

/** Display order and labels. The enum order is alphabetical-ish and unhelpful. */
export const CB_TRADE_ORDER: CbTrade[] = [
  "roofing",
  "elevations",
  "exterior",
  "concrete_asphalt",
  "painting",
  "interior",
  "windows",
  "plumbing",
  "electrical",
  "hvac",
  "mitigation",
  "equipment",
  "labor",
  "demo",
  "misc",
  "landscaping",
];

export const CB_TRADE_LABEL: Record<CbTrade, string> = {
  roofing: "Roofing",
  elevations: "Elevations",
  exterior: "Exterior",
  concrete_asphalt: "Concrete / Asphalt",
  painting: "Painting",
  interior: "Interior",
  windows: "Windows & Doors",
  plumbing: "Plumbing",
  electrical: "Electrical",
  hvac: "HVAC",
  mitigation: "Water/Mold Mitigation",
  equipment: "Equipment",
  labor: "Labor",
  demo: "Demo",
  misc: "Misc Items",
  landscaping: "Tree Removal / Landscaping",
};

/** Matches the dot colours already used on the GC estimate screen. */
export const CB_TRADE_COLOR: Record<CbTrade, string> = {
  roofing: "var(--trade-roofing, #eab308)",
  elevations: "#f97316",
  exterior: "var(--trade-exterior, #d4a574)",
  concrete_asphalt: "#94a3b8",
  painting: "#ec4899",
  interior: "var(--trade-interior, #a855f7)",
  windows: "var(--trade-windows, #06b6d4)",
  plumbing: "var(--trade-plumbing, #3b82f6)",
  electrical: "var(--trade-electrical, #f59e0b)",
  hvac: "var(--trade-hvac, #22c55e)",
  mitigation: "var(--trade-mitigation, #ef4444)",
  equipment: "#0ea5e9",
  labor: "#14b8a6",
  demo: "#6b7280",
  misc: "#8b5cf6",
  landscaping: "#65a30d",
};

export function cbTradeLabel(t: string | null | undefined): string {
  if (!t) return "Other";
  return CB_TRADE_LABEL[t as CbTrade] ?? t;
}
export function cbTradeColor(t: string | null | undefined): string {
  if (!t) return "var(--cb-text-muted)";
  return CB_TRADE_COLOR[t as CbTrade] ?? "var(--cb-text-muted)";
}

/** Sub-groups with no value of their own still need a bucket a rep can find. */
export const CB_UNGROUPED = "Other items";

export interface CbTradeCount {
  trade: CbTrade;
  label: string;
  color: string;
  count: number;
}
export interface CbSubgroupCount {
  trade: CbTrade;
  subgroup: string;
  count: number;
}

const SELECT =
  "id, code, name, unit, trade, trade_name, subgroup, category, waste_pct, default_price, company_id";

/** A catalog row plus the sub-group, which CbCatalogLineItem does not carry. */
export interface CbPriceBookItem extends CbCatalogLineItem {
  subgroup: string;
}

type Row = {
  id: string;
  code: string | null;
  name: string;
  unit: string | null;
  trade: string | null;
  trade_name: string | null;
  subgroup: string | null;
  category: string | null;
  waste_pct: number | null;
  default_price: number | null;
  company_id: string | null;
};

function toItem(r: Row): CbPriceBookItem {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    unit: r.unit,
    trade: r.trade,
    category: r.category,
    waste_pct: r.waste_pct,
    default_price: r.default_price,
    company_id: r.company_id,
    subgroup: (r.subgroup ?? "").trim() || CB_UNGROUPED,
  };
}

/**
 * How many active lines sit under each trade.
 *
 * Postgrest has no GROUP BY, so this pulls the trade column only — one small
 * string per row — and counts client side. It is cached for the session.
 */
export async function loadTradeCounts(companyId?: string | null): Promise<CbTradeCount[]> {
  let q = supabase.from("line_item_master").select("trade").eq("status", "active");
  if (companyId) q = q.or(`company_id.is.null,company_id.eq.${companyId}`);
  const { data, error } = await q;
  if (error) throw error;

  const tally = new Map<string, number>();
  (data ?? []).forEach((r) => {
    const t = (r as { trade: string | null }).trade;
    if (!t) return;
    tally.set(t, (tally.get(t) ?? 0) + 1);
  });

  return CB_TRADE_ORDER.filter((t) => (tally.get(t) ?? 0) > 0).map((t) => ({
    trade: t,
    label: CB_TRADE_LABEL[t],
    color: CB_TRADE_COLOR[t],
    count: tally.get(t) ?? 0,
  }));
}

/** Sub-groups under one trade, alphabetical, with counts. */
export async function loadSubgroupCounts(
  trade: CbTrade,
  companyId?: string | null,
): Promise<CbSubgroupCount[]> {
  let q = supabase
    .from("line_item_master")
    .select("subgroup")
    .eq("status", "active")
    .eq("trade", trade);
  if (companyId) q = q.or(`company_id.is.null,company_id.eq.${companyId}`);
  const { data, error } = await q;
  if (error) throw error;

  const tally = new Map<string, number>();
  (data ?? []).forEach((r) => {
    const s = ((r as { subgroup: string | null }).subgroup ?? "").trim() || CB_UNGROUPED;
    tally.set(s, (tally.get(s) ?? 0) + 1);
  });

  return [...tally.entries()]
    .map(([subgroup, count]) => ({ trade, subgroup, count }))
    .sort((a, b) => {
      /* Keep the catch-all bucket last, everything else alphabetical. */
      if (a.subgroup === CB_UNGROUPED) return 1;
      if (b.subgroup === CB_UNGROUPED) return -1;
      return a.subgroup.localeCompare(b.subgroup);
    });
}

/** Every line in one sub-group, ordered by code so it reads like the book. */
export async function loadSubgroupItems(
  trade: CbTrade,
  subgroup: string,
  companyId?: string | null,
): Promise<CbPriceBookItem[]> {
  let q = supabase
    .from("line_item_master")
    .select(SELECT)
    .eq("status", "active")
    .eq("trade", trade);
  if (companyId) q = q.or(`company_id.is.null,company_id.eq.${companyId}`);

  /* The catch-all bucket is "null or empty", which needs an OR rather than eq. */
  q =
    subgroup === CB_UNGROUPED ? q.or("subgroup.is.null,subgroup.eq.") : q.eq("subgroup", subgroup);

  const { data, error } = await q.order("code", { ascending: true }).limit(500);
  if (error) throw error;
  return ((data ?? []) as Row[]).map(toItem);
}

/** Flat search across the whole book, for when the rep already knows the code. */
export async function searchPriceBook(
  term: string,
  companyId?: string | null,
  limit = 60,
): Promise<CbPriceBookItem[]> {
  const t = term.trim();
  if (!t) return [];
  let q = supabase.from("line_item_master").select(SELECT).eq("status", "active");
  if (companyId) q = q.or(`company_id.is.null,company_id.eq.${companyId}`);
  const safe = t.replace(/[%,()]/g, " ");
  const { data, error } = await q
    .or(`code.ilike.%${safe}%,name.ilike.%${safe}%,subgroup.ilike.%${safe}%`)
    .order("code", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Row[]).map(toItem);
}
