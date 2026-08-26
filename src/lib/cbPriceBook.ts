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
 *
 * EVERY read here pages or counts server-side. The Data API caps a response at
 * 1,000 rows and the master catalog holds ~10,000, so a plain select silently
 * returns the first tenth: the picker showed 1,000 items spread across the
 * trades that happened to come back first, and Plumbing and Concrete/Asphalt
 * — 1,432 real lines between them — did not appear at all. A rep has no way to
 * tell a missing trade from a trade that was never stocked, so nothing in this
 * file may read rows without paging.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { CbCatalogLineItem } from "@/lib/cbCatalogResolve";
import { fetchAllPages } from "@/lib/fetch-all";

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
 * The company scope every read shares: the shared book plus this company's own.
 * `head` asks the server for the count and no rows at all.
 */
function scoped(select: string, companyId?: string | null, head?: boolean) {
  const q = supabase
    .from("line_item_master")
    .select(select, head ? { count: "exact", head: true } : undefined)
    .eq("status", "active");
  return companyId ? q.or(`company_id.is.null,company_id.eq.${companyId}`) : q;
}

/**
 * How many active lines sit under each trade.
 *
 * Counted by the server, one HEAD request per trade, rather than by pulling
 * 10,000 trade strings to the phone and tallying them. Sixteen empty responses
 * beat one truncated page.
 */
export async function loadTradeCounts(companyId?: string | null): Promise<CbTradeCount[]> {
  const counted = await Promise.all(
    CB_TRADE_ORDER.map(async (trade) => {
      const { count, error } = await scoped("id", companyId, true).eq("trade", trade);
      if (error) throw error;
      return { trade, count: count ?? 0 };
    }),
  );

  return counted
    .filter((c) => c.count > 0)
    .map((c) => ({
      trade: c.trade,
      label: CB_TRADE_LABEL[c.trade],
      color: CB_TRADE_COLOR[c.trade],
      count: c.count,
    }));
}

/**
 * Sub-groups under one trade, alphabetical, with counts.
 *
 * The sub-group names are not knowable without reading the rows, so this pages
 * through one short column. Windows & Doors alone is 2,393 lines — three pages,
 * not one silent truncation.
 */
export async function loadSubgroupCounts(
  trade: CbTrade,
  companyId?: string | null,
): Promise<CbSubgroupCount[]> {
  const rows = await fetchAllPages<{ subgroup: string | null }>(
    (from, to) =>
      scoped("subgroup", companyId)
        .eq("trade", trade)
        .order("subgroup", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{
        data: { subgroup: string | null }[] | null;
        error: { message: string } | null;
      }>,
  );

  const tally = new Map<string, number>();
  rows.forEach((r) => {
    const s = (r.subgroup ?? "").trim() || CB_UNGROUPED;
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
  const rows = await fetchAllPages<Row>((from, to) => {
    const base = scoped(SELECT, companyId).eq("trade", trade);
    /* The catch-all bucket is "null or empty", which needs an OR rather than eq. */
    const q =
      subgroup === CB_UNGROUPED
        ? base.or("subgroup.is.null,subgroup.eq.")
        : base.eq("subgroup", subgroup);
    return q.order("code", { ascending: true }).range(from, to) as unknown as PromiseLike<{
      data: Row[] | null;
      error: { message: string } | null;
    }>;
  });
  return rows.map(toItem);
}

/**
 * Flat search across the whole book, for when the rep already knows the code.
 *
 * This limit is a deliberate one, unlike the cap that used to truncate the
 * browse lists: a search that returns 400 rows has not helped anyone type a
 * better word. 300 is far past where a rep stops scrolling and still leaves
 * room for a broad term like "shingle" to show its whole range.
 */
export async function searchPriceBook(
  term: string,
  companyId?: string | null,
  limit = 300,
): Promise<CbPriceBookItem[]> {
  const t = term.trim();
  if (!t) return [];
  const safe = t.replace(/[%,()]/g, " ");
  const { data, error } = await scoped(SELECT, companyId)
    .or(`code.ilike.%${safe}%,name.ilike.%${safe}%,subgroup.ilike.%${safe}%`)
    .order("code", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(toItem);
}
