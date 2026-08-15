/**
 * Claim Buddy estimate.
 *
 * Reuses the GlobalContractor estimate tables and catalog — nothing parallel:
 *   estimates / estimate_line_items      the document
 *   line_item_master                     real codes, names, units, waste
 *   master_macros / master_macro_items   assembly expansion
 *   company_macro_pricing / price_books / line_item_prices   pricing resolution
 *
 * Two modes:
 *   per_square  — one number the rep can quote from the driveway. Lines list
 *                 WHAT is included, with no quantity and no price.
 *   line_item   — full carrier-style build from measurement + takeoff + photos.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  readSheet,
  computeVentilation,
  CB_EXTERIOR_FIELDS,
  CB_INTERIOR_FIELDS,
  type CbSheet,
} from "@/lib/cbSheet";
import { resolvePriceBook } from "@/lib/resolve-price-book";
import { findAssembly, type CbAssembly, type CbQtyBasis } from "@/lib/cbRoofSystems";
import { resolveCodeRules, type CodeRuleItem, type CodeRuleSet } from "@/lib/cbCodeRules";
import {
  normalizeRoofSystem,
  roofSystemLabel,
  resolveCatalogScope,
  type CbQtyContext,
} from "@/lib/cbCatalogResolve";
import type { CbElevation, CbElevationState, CbItemEntry, CbRoom, CbTakeoffData } from "@/lib/cbTakeoff";

export type CbEstimateMode = "per_square" | "line_item";
export type CbLineSource = "measurement" | "takeoff" | "photo_analysis" | "macro" | "code";

export const CB_SOURCE_LABEL: Record<CbLineSource, string> = {
  measurement: "Measurement",
  takeoff: "Takeoff",
  photo_analysis: "Photos",
  macro: "Assembly",
  code: "Code",
};


export interface CbDraftLine {
  id: string;
  line_item_id: string | null;
  code: string | null;
  name: string;
  unit: string;
  qty: number;
  unit_price: number;
  trade: string | null;
  category: string | null;
  source: CbLineSource;
  /** Plain-language explanation of where the quantity came from. */
  basis: string;
  /** Set on code-injected lines so an adjuster can see the citation. */
  code_reference?: string | null;
}


export interface CbEstimateTotals {
  subtotal: number;
  markup: number;
  overhead: number;
  profit: number;
  tax: number;
  total: number;
}

export interface CbEstimatePercents {
  markup_pct: number;
  overhead_pct: number;
  profit_pct: number;
  tax_pct: number;
}

const n = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const r2 = (v: number) => Math.round(v * 100) / 100;
const uid = () => Math.random().toString(36).slice(2, 10);

/* ------------------------------------------------------------------ */
/* master catalog matching                                             */
/* ------------------------------------------------------------------ */

export interface MasterItem {
  id: string;
  company_id: string | null;
  code: string | null;
  name: string;
  trade: string | null;
  category: string | null;
  unit: string | null;
  waste_pct: number | null;
  default_price: number | null;
}

/** One thing we want in the estimate, described in words, not codes. */
interface Spec {
  key: string;
  /** Every word must appear in the catalog item name. */
  must: string[];
  /** Any of these boosts the match. */
  prefer?: string[];
  /** Never match a name containing these. */
  avoid?: string[];
  unit: string;
  label: string;
}

function scoreItem(item: MasterItem, spec: Spec, companyId: string | null): number | null {
  const name = item.name.toLowerCase();
  for (const w of spec.must) if (!name.includes(w)) return null;
  for (const w of spec.avoid ?? []) if (name.includes(w)) return null;
  let s = 100 - Math.min(60, name.length / 2);
  for (const w of spec.prefer ?? []) if (name.includes(w)) s += 25;
  if ((item.unit ?? "").toUpperCase() === spec.unit.toUpperCase()) s += 40;
  if (companyId && item.company_id === companyId) s += 30;
  if (!item.company_id) s += 5;
  return s;
}

/** Pull a candidate slice of line_item_master for the specs we care about. */
export async function loadMasterCandidates(specs: Spec[]): Promise<MasterItem[]> {
  const patterns = Array.from(new Set(specs.map((s) => s.must[0])));
  const or = patterns.map((p) => `name.ilike."%${p}%"`).join(",");
  const { data } = await supabase
    .from("line_item_master")
    .select("id, company_id, code, name, trade, category, unit, waste_pct, default_price")
    .eq("status", "active")
    .or(or)
    .limit(2000);
  return (data ?? []) as MasterItem[];
}

function pick(items: MasterItem[], spec: Spec, companyId: string | null): MasterItem | null {
  let best: MasterItem | null = null;
  let bestScore = -1;
  for (const it of items) {
    const s = scoreItem(it, spec, companyId);
    if (s != null && s > bestScore) {
      best = it;
      bestScore = s;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* pricing resolution                                                  */
/* ------------------------------------------------------------------ */

export interface PriceBookIndex {
  macro: Record<string, number>;
  book: Record<string, number>;
  bookName: string | null;
}

export async function loadPricing(
  companyId: string | null,
  job: { zip?: string | null; state?: string | null },
): Promise<PriceBookIndex> {
  const macro: Record<string, number> = {};
  const book: Record<string, number> = {};
  let bookName: string | null = null;

  if (companyId) {
    const { data } = await supabase
      .from("company_macro_pricing")
      .select("line_item_master_id, unit_price")
      .eq("company_id", companyId);
    for (const row of data ?? []) {
      if (row.line_item_master_id) macro[row.line_item_master_id] = n(row.unit_price);
    }
  }

  const resolved = await resolvePriceBook({
    companyId,
    zip: job.zip ?? null,
    state: job.state ?? null,
    pricingType: "insurance",
  });
  if (resolved) {
    bookName = resolved.name;
    const { data } = await supabase
      .from("line_item_prices")
      .select("line_item_master_id, unit_price")
      .eq("price_book_id", resolved.id);
    for (const row of data ?? []) {
      if (row.line_item_master_id) book[row.line_item_master_id] = n(row.unit_price);
    }
  }
  return { macro, book, bookName };
}

/** company_macro_pricing → price book → line_item_master.default_price */
export function priceFor(item: MasterItem | null, prices: PriceBookIndex): number {
  if (!item) return 0;
  return n(prices.macro[item.id]) || n(prices.book[item.id]) || n(item.default_price);
}

/* ------------------------------------------------------------------ */
/* inputs                                                              */
/* ------------------------------------------------------------------ */

export interface CbEstimateJob {
  id: string;
  workspace_id: string;
  gc_job_id: string | null;
  address: string | null;
  city: string | null;
  county: string | null;

  state: string | null;
  zip: string | null;
  customer_name: string | null;
}

export interface CbEstimateInputs {
  job: CbEstimateJob;
  companyId: string | null;
  company: Record<string, unknown> | null;
  measurement: Record<string, unknown> | null;
  sheet: CbSheet;
  elevations: Partial<Record<CbElevation, CbElevationState>>;
  roofHardware: Record<string, CbItemEntry>;
  rooms: CbRoom[];
  catalog: Record<string, { id: string; label: string; unit: string | null }>;
  analysis: Record<string, unknown> | null;
  defaultPricePerSquare: number;
  percents: CbEstimatePercents;
  existing: { estimate: Record<string, unknown>; lines: CbDraftLine[] } | null;
}

export async function loadCbEstimateInputs(jobId: string): Promise<CbEstimateInputs> {
  const { data: job, error } = await supabase
    .from("cb_jobs")
    .select("id, workspace_id, gc_job_id, address, city, county, state, zip, customer_name")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  if (!job) throw new Error("Inspection not found");

  const [{ data: ws }, { data: measurement }, { data: takeoff }, { data: cat }, { data: cbCompany }] =
    await Promise.all([
      supabase
        .from("cb_workspaces")
        .select("gc_company_id, default_price_per_square")
        .eq("id", job.workspace_id)
        .maybeSingle(),
      supabase.from("cb_measurements").select("*").eq("job_id", jobId).maybeSingle(),
      supabase.from("cb_takeoffs").select("data, elevations").eq("job_id", jobId).maybeSingle(),
      supabase.from("cb_item_catalog").select("id, item_key, label, unit"),
      supabase.from("cb_companies").select("*").eq("workspace_id", job.workspace_id).maybeSingle(),
    ]);

  const companyId = (ws?.gc_company_id as string | null) ?? null;

  const [{ data: company }, analysisRes, existingRes] = await Promise.all([
    companyId
      ? supabase
          .from("companies")
          .select("default_markup_pct, default_overhead_pct, default_profit_pct, default_tax_rate")
          .eq("id", companyId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    job.gc_job_id
      ? supabase
          .from("job_property_analyses")
          .select("analysis")
          .eq("job_id", job.gc_job_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("estimates")
      .select("*")
      .eq("cb_job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let existing: CbEstimateInputs["existing"] = null;
  const estRow = (existingRes as { data: Record<string, unknown> | null }).data;
  if (estRow) {
    const { data: lines } = await supabase
      .from("estimate_line_items")
      .select("*")
      .eq("estimate_id", estRow.id as string)
      .order("sort_order", { ascending: true });
    existing = {
      estimate: estRow,
      lines: (lines ?? []).map((l) => ({
        id: l.id as string,
        line_item_id: (l.line_item_id as string | null) ?? null,
        code: (l.code as string | null) ?? null,
        name: (l.name as string) ?? "",
        unit: (l.unit as string) ?? "EA",
        qty: n(l.qty),
        unit_price: n(l.unit_price),
        trade: (l.trade as string | null) ?? null,
        category: (l.category as string | null) ?? null,
        source: ((l.source as CbLineSource) ?? "takeoff") as CbLineSource,
        basis: (l.note as string) ?? "",
      })),
    };
  }

  const data = ((takeoff?.data as CbTakeoffData) ?? {}) as CbTakeoffData;
  const catalog: Record<string, { id: string; label: string; unit: string | null }> = {};
  for (const row of cat ?? [])
    catalog[row.item_key] = { id: row.id as string, label: row.label, unit: row.unit };

  const co = (company as Record<string, unknown> | null) ?? null;
  return {
    job: job as CbEstimateJob,
    companyId,
    company: (cbCompany as Record<string, unknown> | null) ?? null,
    measurement: (measurement as Record<string, unknown> | null) ?? null,
    sheet: readSheet(data),
    elevations: (takeoff?.elevations as CbEstimateInputs["elevations"]) ?? {},
    roofHardware: (data.roofHardware ?? {}) as Record<string, CbItemEntry>,
    rooms: Array.isArray(data.rooms) ? (data.rooms as CbRoom[]) : [],
    catalog,
    analysis: (analysisRes as { data: { analysis?: unknown } | null }).data?.analysis
      ? ((analysisRes as { data: { analysis: Record<string, unknown> } }).data.analysis)
      : null,
    defaultPricePerSquare: n(ws?.default_price_per_square),
    percents: {
      markup_pct: n(estRow?.markup_pct) || n(co?.default_markup_pct),
      overhead_pct: n(estRow?.overhead_pct) || n(co?.default_overhead_pct),
      profit_pct: n(estRow?.profit_pct) || n(co?.default_profit_pct),
      tax_pct: n(estRow?.tax_pct) || n(co?.default_tax_rate),
    },
    existing,
  };
}

/* ------------------------------------------------------------------ */
/* measurement completeness → default mode                             */
/* ------------------------------------------------------------------ */

export function measurementIsComplete(m: Record<string, unknown> | null): boolean {
  if (!m) return false;
  if (n(m.total_squares) <= 0) return false;
  const linear = ["eave_lf", "rake_lf", "ridge_lf", "valley_lf"].map((k) => n(m[k]));
  return linear.filter((v) => v > 0).length >= 3;
}

/* ------------------------------------------------------------------ */
/* the scope, in words — shared by both modes                          */
/* ------------------------------------------------------------------ */

interface PlannedLine extends Spec {
  qty: number;
  source: CbLineSource;
  basis: string;
  /** LF value that has to become SF when the catalog item is sold by SF. */
  lfToSf?: boolean;
}

function planRoofLines(inputs: CbEstimateInputs, assembly: CbAssembly): PlannedLine[] {
  const m = inputs.measurement;
  const g = (k: string) => n(m?.[k]);
  const sheet = inputs.sheet;
  const waste = g("waste_pct") || 15;
  /* total_squares already carries waste — never apply it a second time. */
  const squaresWithWaste = g("total_squares");
  const trueSquares =
    (g("total_area_sqft") || 0) > 0
      ? g("total_area_sqft") / 100
      : squaresWithWaste / (1 + waste / 100);
  const squares = trueSquares;
  const layers = sheet.roof_system.layers ?? 1;
  const eave = g("eave_lf");
  const rake = g("rake_lf");
  const ridge = g("ridge_lf");
  const hip = g("hip_lf");
  const valley = g("valley_lf");
  const out: PlannedLine[] = [];

  const add = (p: PlannedLine) => {
    if (p.qty > 0) out.push(p);
  };

  /* ---- the selected roof system's assembly ---- */
  const basisValue = (b: CbQtyBasis): { qty: number; text: string } => {
    switch (b) {
      case "squares":
        return { qty: squares, text: `${r2(squares)} SQ of roof area` };
      case "squares_waste":
        return { qty: squaresWithWaste, text: `${r2(squares)} SQ + ${waste}% waste` };
      case "tearoff":
        return {
          qty: squares * layers,
          text: `${r2(squares)} SQ × ${layers} layer${layers === 1 ? "" : "s"}`,
        };
      case "eave_valley":
        return { qty: eave + valley, text: `Eave ${r2(eave)} LF + valley ${r2(valley)} LF` };
      case "eave_rake":
        return { qty: eave + rake, text: `Eave ${r2(eave)} LF + rake ${r2(rake)} LF` };
      case "ridge_hip":
        return { qty: ridge + hip, text: `Ridge ${r2(ridge)} LF + hip ${r2(hip)} LF` };
      case "ridge":
        return { qty: ridge, text: `Ridge ${r2(ridge)} LF` };
      case "eave":
        return { qty: eave, text: `Eave ${r2(eave)} LF` };
      case "valley":
        return { qty: valley, text: `Valley ${r2(valley)} LF` };
      case "perimeter":
        return { qty: eave + rake, text: `Perimeter ${r2(eave + rake)} LF` };
      default:
        return { qty: 0, text: "" };
    }
  };

  for (const line of assembly.lines) {
    const { qty, text } = basisValue(line.basis);
    add({
      key: line.key,
      must: line.must,
      prefer: line.prefer,
      avoid: line.avoid,
      unit: line.unit,
      label: line.label,
      lfToSf: line.lfToSf,
      qty,
      source: "measurement",
      basis: `${text} — ${assembly.label} assembly`,
    });
  }

  /* ---- shared, system-independent scope ---- */

  add({
    key: "dripedge",
    must: ["drip edge"],
    avoid: ["remove"],
    unit: "LF",
    label: "Drip edge",
    qty: g("drip_edge_lf") || eave + rake,
    source: "measurement",
    basis: `Eave ${r2(eave)} LF + rake ${r2(rake)} LF`,
  });
  add({
    key: "valleymetal",
    must: ["valley metal"],
    unit: "LF",
    label: "Valley metal",
    qty: valley,
    source: "measurement",
    basis: `Valley ${r2(valley)} LF`,
  });
  add({
    key: "stepflash",
    must: ["step flashing"],
    unit: "EA",
    label: "Step flashing",
    qty: sheet.flashing.step_flashing_lf ?? g("step_flashing_lf"),
    source: sheet.flashing.step_flashing_lf ? "takeoff" : "measurement",
    basis: `Step flashing ${r2(sheet.flashing.step_flashing_lf ?? g("step_flashing_lf"))} LF`,
  });
  add({
    key: "wallflash",
    must: ["flashing"],
    prefer: ["galvanized steel flashing"],
    avoid: ["pipe", "step", "remove"],
    unit: "LF",
    label: "Roof-to-wall flashing",
    qty: sheet.flashing.roof_to_wall_lf ?? g("wall_flashing_lf"),
    source: sheet.flashing.roof_to_wall_lf ? "takeoff" : "measurement",
    basis: `Wall flashing ${r2(sheet.flashing.roof_to_wall_lf ?? g("wall_flashing_lf"))} LF`,
  });

  /* penetrations — counted on the takeoff sheet */
  const pens: [string, number | undefined, string][] = [
    ['Pipe jack flashing — up to 4"', sheet.penetrations.pipe_1_5, "up to 4"],
    ['Pipe jack flashing — 2"', sheet.penetrations.pipe_2, "up to 4"],
    ['Pipe jack flashing — 3"', sheet.penetrations.pipe_3, "up to 4"],
    ['Pipe jack flashing — 4"', sheet.penetrations.pipe_4, "up to 4"],
    ["Lead pipe jack", sheet.penetrations.lead_boots, "lead"],
    ["Split boot pipe jack", sheet.penetrations.split_boots, "split boot"],
  ];
  pens.forEach(([label, qty, hint], i) => {
    add({
      key: `pipe-${i}`,
      must: ["pipe jack"],
      prefer: [hint],
      avoid: ["remove"],
      unit: "EA",
      label,
      qty: n(qty),
      source: "takeoff",
      basis: `${n(qty)} counted on the roof`,
    });
  });

  /* ventilation — by the NFA calculation, not by guess */
  const vent = computeVentilation(sheet.ventilation, squares, (m?.pitch as string) ?? null);
  add({
    key: "boxvent",
    must: ["roof vent"],
    prefer: ["turtle"],
    avoid: ["remove"],
    unit: "EA",
    label: "Roof vent",
    qty: sheet.ventilation.box_vent_qty ?? 0,
    source: "takeoff",
    basis: `${sheet.ventilation.box_vent_qty ?? 0} existing vents`,
  });
  if (vent.under && ridge > 0) {
    add({
      key: "ridgevent",
      must: ["ridge vent"],
      prefer: ["shingle-over", "continuous"],
      unit: "LF",
      label: "Continuous ridge vent",
      qty: Math.min(ridge, Math.ceil(vent.deficit / 18)),
      source: "measurement",
      basis: `NFA short ${vent.deficit.toLocaleString()} sq in ÷ 18 per LF`,
    });
  }

  /* gutters */
  const gutterLf = sheet.gutters.lf ?? g("gutter_lf");
  add({
    key: "gutter",
    must: ["gutter"],
    prefer: ["aluminum"],
    avoid: ["remove", "apron", "guard"],
    unit: "LF",
    label: "Gutter",
    qty: gutterLf,
    source: sheet.gutters.lf ? "takeoff" : "measurement",
    basis: `${r2(gutterLf)} LF of gutter`,
  });
  add({
    key: "downspout",
    must: ["downspout"],
    avoid: ["remove"],
    unit: "LF",
    label: "Downspout",
    qty: (sheet.gutters.downspout_qty ?? 0) * 20,
    source: "takeoff",
    basis: `${sheet.gutters.downspout_qty ?? 0} downspouts × 20 LF`,
  });

  return out;
}

/** Checked exterior + interior takeoff items, with their catalog units. */
function planTakeoffLines(inputs: CbEstimateInputs): PlannedLine[] {
  const out: PlannedLine[] = [];
  const seen = new Map<string, number>();

  const bump = (key: string, qty: number) => seen.set(key, (seen.get(key) ?? 0) + (qty || 1));

  for (const state of Object.values(inputs.elevations)) {
    for (const [key, entry] of Object.entries(state?.items ?? {})) bump(key, n(entry?.qty));
    for (const [key, entry] of Object.entries(state?.roofItems ?? {})) bump(key, n(entry?.qty));
  }
  for (const [key, entry] of Object.entries(inputs.roofHardware ?? {})) bump(key, n(entry?.qty));
  for (const room of inputs.rooms) {
    for (const [key, entry] of Object.entries(room.items ?? {})) bump(key, n(entry?.qty));
  }

  for (const [key, qty] of seen) {
    const cat = inputs.catalog[key];
    if (!cat) continue;
    const words = cat.label.toLowerCase().split(/[^a-z0-9"]+/).filter((w) => w.length > 3);
    if (!words.length) continue;
    out.push({
      key: `takeoff-${key}`,
      must: [words[0]],
      prefer: words.slice(1, 3),
      avoid: ["remove"],
      unit: (cat.unit ?? "EA").toUpperCase(),
      label: cat.label,
      qty: qty || 1,
      source: "takeoff",
      basis: "Checked on the inspection walk",
    });
  }

  /* sheet-driven exterior + interior takeoff quantities */
  const areaLines: { label: string; unit: string; match: string[]; qty: number; where: string }[] = [];
  for (const [elevKey, area] of Object.entries(inputs.sheet.exterior ?? {})) {
    for (const spec of CB_EXTERIOR_FIELDS) {
      const qty = n((area as Record<string, unknown>)[spec.key as string]);
      if (qty > 0)
        areaLines.push({ label: spec.label, unit: spec.unit, match: spec.match, qty, where: elevKey });
    }
  }
  for (const [roomId, area] of Object.entries(inputs.sheet.interior ?? {})) {
    const roomName = inputs.rooms.find((r) => r.id === roomId)?.name ?? "room";
    for (const spec of CB_INTERIOR_FIELDS) {
      const qty = n((area as Record<string, unknown>)[spec.key as string]);
      if (qty > 0)
        areaLines.push({ label: spec.label, unit: spec.unit, match: spec.match, qty, where: roomName });
    }
  }
  const grouped = new Map<string, { label: string; unit: string; match: string[]; qty: number; where: string[] }>();
  for (const l of areaLines) {
    const k = `${l.label}|${l.unit}`;
    const prev = grouped.get(k);
    if (prev) {
      prev.qty += l.qty;
      prev.where.push(l.where);
    } else grouped.set(k, { ...l, where: [l.where] });
  }
  for (const [k, l] of grouped) {
    out.push({
      key: `area-${k}`,
      must: [l.match[0]],
      prefer: l.match.slice(1),
      avoid: ["remove"],
      unit: l.unit,
      label: l.label,
      qty: l.qty,
      source: "takeoff",
      basis: `${l.label} takeoff — ${l.where.join(", ")}`,
    });
  }

  return out;
}


/** Anything the photo analysis saw that the walk did not already cover. */
function planPhotoLines(inputs: CbEstimateInputs): PlannedLine[] {
  const observed = (inputs.analysis?.observed_items ?? inputs.analysis?.items) as
    | Array<Record<string, unknown>>
    | undefined;
  if (!Array.isArray(observed)) return [];
  return observed
    .map((it, i): PlannedLine | null => {
      const description = String(it.description ?? it.name ?? "").trim();
      const qty = n(it.suggested_qty ?? it.qty);
      if (!description || qty <= 0) return null;
      const words = description.toLowerCase().split(/[^a-z0-9"]+/).filter((w) => w.length > 3);
      if (!words.length) return null;
      return {
        key: `photo-${i}`,
        must: [words[0]],
        prefer: words.slice(1, 3),
        unit: String(it.unit ?? "EA").toUpperCase(),
        label: description,
        qty,
        source: "photo_analysis" as CbLineSource,
        basis: "Seen in the inspection photos",
      };
    })
    .filter((x): x is PlannedLine => x !== null);
}

/* ------------------------------------------------------------------ */
/* macros                                                              */
/* ------------------------------------------------------------------ */

async function expandMacros(
  inputs: CbEstimateInputs,
  prices: PriceBookIndex,
  assembly: CbAssembly,
): Promise<CbDraftLine[]> {
  const squares = n(inputs.measurement?.total_squares);
  const { data: allMacros } = await supabase
    .from("master_macros")
    .select("id, name, trade, category, is_default, company_id")
    .eq("is_default", true)
    .or(inputs.companyId ? `company_id.eq.${inputs.companyId},company_id.is.null` : "company_id.is.null");
  /* Only macros written for the SELECTED roof system may expand. A shingle
     macro must never land on a tile roof. */
  const macros = (allMacros ?? []).filter((m) => {
    const name = (m.name ?? "").toLowerCase();
    return assembly.aliases.some((a) => name.includes(a)) || name.includes(assembly.label.toLowerCase());
  });
  if (!macros.length) return [];


  const { data: items } = await supabase
    .from("master_macro_items")
    .select("macro_id, line_item_master_id, qty, unit, qty_mode, is_optional, sort_order")
    .in(
      "macro_id",
      macros.map((m) => m.id),
    )
    .order("sort_order", { ascending: true });
  if (!items?.length) return [];

  const masterIds = Array.from(
    new Set(items.map((i) => i.line_item_master_id).filter(Boolean) as string[]),
  );
  const { data: masters } = await supabase
    .from("line_item_master")
    .select("id, company_id, code, name, trade, category, unit, waste_pct, default_price")
    .in("id", masterIds);
  const byId = new Map((masters ?? []).map((m) => [m.id, m as MasterItem]));

  const out: CbDraftLine[] = [];
  for (const item of items) {
    if (item.is_optional) continue;
    const master = item.line_item_master_id ? byId.get(item.line_item_master_id) : null;
    if (!master) continue;
    const base = n(item.qty) || 1;
    const mode = (item.qty_mode ?? "fixed").toLowerCase();
    let qty = base;
    let basis = `Assembly quantity ${base}`;
    if (mode.includes("square") || mode.includes("per_sq")) {
      qty = base * squares;
      basis = `${base} per SQ × ${r2(squares)} SQ`;
    } else if (mode.includes("lf")) {
      qty = base * (n(inputs.measurement?.eave_lf) + n(inputs.measurement?.rake_lf));
      basis = `${base} per LF of perimeter`;
    } else if (mode.includes("area") || mode.includes("sf")) {
      qty = base * n(inputs.measurement?.total_area_sqft);
      basis = `${base} per SF of roof area`;
    }
    if (qty <= 0) continue;
    out.push({
      id: uid(),
      line_item_id: master.id,
      code: master.code,
      name: master.name,
      unit: (item.unit ?? master.unit ?? "EA").toUpperCase(),
      qty: r2(qty * (1 + n(master.waste_pct) / 100)),
      unit_price: priceFor(master, prices),
      trade: master.trade,
      category: master.category,
      source: "macro",
      basis,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* draft builders                                                      */
/* ------------------------------------------------------------------ */

function toDraft(planned: PlannedLine[], masters: MasterItem[], inputs: CbEstimateInputs, prices: PriceBookIndex, priced: boolean): CbDraftLine[] {
  const out: CbDraftLine[] = [];
  const used = new Set<string>();
  for (const p of planned) {
    const match = pick(masters, p, inputs.companyId);
    const unit = (match?.unit ?? p.unit).toUpperCase();
    let qty = p.qty;
    const plannedUnit = p.unit.toUpperCase();
    if (plannedUnit === "SQ" && unit === "SF") qty = qty * 100;
    else if (plannedUnit === "SF" && unit === "SQ") qty = qty / 100;

    if (p.lfToSf && unit === "SF") qty = qty * 3; // 3 ft roll width
    const waste = n(match?.waste_pct);
    if (waste > 0) qty = qty * (1 + waste / 100);
    const key = match?.id ?? `raw-${p.key}`;
    if (used.has(key)) continue;
    used.add(key);
    out.push({
      id: uid(),
      line_item_id: match?.id ?? null,
      code: match?.code ?? null,
      name: match?.name ?? p.label,
      unit,
      qty: priced ? r2(qty) : 0,
      unit_price: priced ? priceFor(match, prices) : 0,
      trade: match?.trade ?? "roofing",
      category: match?.category ?? null,
      source: p.source,
      basis: priced ? `${p.basis}${waste > 0 ? ` + ${waste}% waste` : ""}` : p.label,
    });
  }
  return out;
}

export interface CbEstimateProvenance {
  roofSystem: string | null;
  assemblyKey: string | null;
  assemblyLabel: string | null;
  codeRuleSetName: string | null;
  codeRulesApplied: number;
  priceBookName: string | null;
  /** The catalog version the numbers came from — stamped on the estimate. */
  catalogVersionId: string | null;
  /** Checked items with no mapping in this catalog version. */
  unmappedCount: number;
  /** Set when the estimate cannot be built — never silently substituted. */
  error: string | null;
}

/** Turn resolved code rules into estimate lines. Applied AFTER expansion. */
async function applyCodeRules(
  inputs: CbEstimateInputs,
  prices: PriceBookIndex,
  assembly: CbAssembly,
  items: CodeRuleItem[],
  set: CodeRuleSet | null,
): Promise<CbDraftLine[]> {
  if (!set || !items.length) return [];
  const m = inputs.measurement;
  const g = (k: string) => n(m?.[k]);
  const squares = g("total_area_sqft") > 0 ? g("total_area_sqft") / 100 : g("total_squares");
  const perimeter = g("eave_lf") + g("rake_lf");

  const applicable = items.filter((it) => {
    const target = (it.applies_to_roof_system ?? "").trim().toLowerCase();
    if (!target || target === "all") return true;
    return target === assembly.key || assembly.aliases.some((a) => target.includes(a));
  });
  if (!applicable.length) return [];

  const ids = applicable.map((i) => i.line_item_id).filter(Boolean) as string[];
  const byId = new Map<string, MasterItem>();
  if (ids.length) {
    const { data } = await supabase
      .from("line_item_master")
      .select("id, company_id, code, name, trade, category, unit, waste_pct, default_price")
      .in("id", ids);
    for (const row of data ?? []) byId.set(row.id, row as MasterItem);
  }

  const out: CbDraftLine[] = [];
  for (const rule of applicable) {
    const master = rule.line_item_id ? byId.get(rule.line_item_id) ?? null : null;
    const factor = n(rule.qty_factor) || 1;
    const mode = (rule.qty_mode ?? "fixed").toLowerCase();
    let qty = factor;
    if (mode.includes("square") || mode.includes("sq")) qty = factor * squares;
    else if (mode.includes("perimeter") || mode.includes("lf")) qty = factor * perimeter;
    else if (mode.includes("sf") || mode.includes("area")) qty = factor * g("total_area_sqft");
    if (qty <= 0) continue;
    out.push({
      id: uid(),
      line_item_id: master?.id ?? null,
      code: master?.code ?? null,
      name: master?.name ?? rule.item_name ?? "Code-required item",
      unit: (rule.unit ?? master?.unit ?? "EA").toUpperCase(),
      qty: r2(qty),
      unit_price: priceFor(master, prices),
      trade: master?.trade ?? "roofing",
      category: master?.category ?? null,
      source: "code",
      code_reference: rule.code_reference,
      basis: `${set.name} — ${rule.code_reference}${rule.note ? ` · ${rule.note}` : ""}`,
    });
  }
  return out;
}

/** Everything the rep checked on the walk, as catalog_item_id → count. */
function checkedCatalogItems(inputs: CbEstimateInputs): Record<string, number> {
  const byKey = new Map<string, number>();
  const bump = (key: string, qty: number) => byKey.set(key, (byKey.get(key) ?? 0) + (qty || 1));
  for (const state of Object.values(inputs.elevations)) {
    for (const [key, entry] of Object.entries(state?.items ?? {})) bump(key, n(entry?.qty));
    for (const [key, entry] of Object.entries(state?.roofItems ?? {})) bump(key, n(entry?.qty));
  }
  for (const [key, entry] of Object.entries(inputs.roofHardware ?? {})) bump(key, n(entry?.qty));
  for (const room of inputs.rooms) {
    for (const [key, entry] of Object.entries(room.items ?? {})) bump(key, n(entry?.qty));
  }
  const out: Record<string, number> = {};
  for (const [key, qty] of byKey) {
    const cat = inputs.catalog[key];
    if (cat?.id) out[cat.id] = (out[cat.id] ?? 0) + qty;
  }
  return out;
}

function qtyContext(inputs: CbEstimateInputs): CbQtyContext {
  const m = inputs.measurement;
  const g = (k: string) => n(m?.[k]);
  const area = g("total_area_sqft");
  return {
    squares: area > 0 ? area / 100 : g("total_squares"),
    area_sqft: area || g("total_squares") * 100,
    eave_lf: g("eave_lf"),
    rake_lf: g("rake_lf"),
    ridge_lf: g("ridge_lf"),
    hip_lf: g("hip_lf"),
    valley_lf: g("valley_lf"),
    step_lf: n(inputs.sheet.flashing.step_flashing_lf) || g("step_flashing_lf"),
    wall_lf: n(inputs.sheet.flashing.roof_to_wall_lf) || g("wall_flashing_lf"),
    openings: Object.keys(inputs.sheet.exterior ?? {}).length,
    elevations: Object.keys(inputs.elevations ?? {}).length,
    rooms: inputs.rooms.length,
  };
}

/**
 * The estimate is produced from the catalog — base assembly by roof system,
 * item mappings from the walk, then code rules. Nothing is inferred from the
 * name of the roof system.
 */
export async function buildCbDraft(
  inputs: CbEstimateInputs,
  mode: CbEstimateMode,
  versionId?: string | null,
): Promise<{ lines: CbDraftLine[]; bookName: string | null; provenance: CbEstimateProvenance }> {
  const roofSystem =
    inputs.sheet.roof_system.roof_type === "Other"
      ? inputs.sheet.roof_system.roof_type_other ?? "Other"
      : inputs.sheet.roof_system.roof_type ?? null;
  const roofSystemKey = normalizeRoofSystem(roofSystem);

  const provenance: CbEstimateProvenance = {
    roofSystem: roofSystem ?? null,
    assemblyKey: roofSystemKey,
    assemblyLabel: roofSystemKey ? roofSystemLabel(roofSystemKey) : null,
    codeRuleSetName: null,
    codeRulesApplied: 0,
    priceBookName: null,
    catalogVersionId: null,
    unmappedCount: 0,
    error: null,
  };

  const resolution = await resolveCatalogScope({
    roofSystemKey,
    ctx: qtyContext(inputs),
    checked: checkedCatalogItems(inputs),
    companyId: inputs.companyId,
    versionId: versionId ?? null,
  });
  provenance.catalogVersionId = resolution.version?.id ?? null;
  provenance.assemblyLabel = resolution.assembly?.name ?? provenance.assemblyLabel;
  provenance.unmappedCount = resolution.unmapped.length;

  if (resolution.error) {
    provenance.error = resolution.error;
    return { lines: [], bookName: null, provenance };
  }

  const prices =
    mode === "line_item"
      ? await loadPricing(inputs.companyId, inputs.job)
      : { macro: {}, book: {}, bookName: null };

  const priced = mode === "line_item";
  const lines: CbDraftLine[] = resolution.lines.map((l) => ({
    id: uid(),
    line_item_id: l.line_item_id,
    code: l.code,
    name: l.name,
    unit: l.unit,
    qty: priced ? l.qty : 0,
    unit_price: priced
      ? n(prices.macro[l.line_item_id ?? ""]) || n(prices.book[l.line_item_id ?? ""]) || l.default_price
      : 0,
    trade: l.trade,
    category: l.category,
    source: l.source === "assembly" ? "macro" : "takeoff",
    basis: priced ? l.basis : l.name,
  }));

  if (mode === "line_item") {
    /* photo findings the walk did not already cover */
    const photoPlanned = planPhotoLines(inputs);
    if (photoPlanned.length) {
      const masters = await loadMasterCandidates(photoPlanned);
      const known = new Set(lines.map((l) => l.line_item_id).filter(Boolean));
      for (const l of toDraft(photoPlanned, masters, inputs, prices, true)) {
        if (!l.line_item_id || !known.has(l.line_item_id)) lines.push(l);
      }
    }

    /* code rules last */
    const codeAssembly: CbAssembly = {
      key: roofSystemKey ?? "",
      label: roofSystemLabel(roofSystemKey),
      aliases: [roofSystemLabel(roofSystemKey).toLowerCase()],
      lines: [],
    };
    const rules = await resolveCodeRules({ state: inputs.job.state, county: inputs.job.county });
    provenance.codeRuleSetName = rules.set?.name ?? null;
    const codeLines = await applyCodeRules(inputs, prices, codeAssembly, rules.items, rules.set);
    provenance.codeRulesApplied = codeLines.length;
    lines.push(...codeLines);
  }

  provenance.priceBookName = prices.bookName;
  return { lines, bookName: prices.bookName, provenance };
}


/* ------------------------------------------------------------------ */
/* totals                                                              */
/* ------------------------------------------------------------------ */

export function computeTotals(lines: CbDraftLine[], pct: CbEstimatePercents): CbEstimateTotals {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
  const markup = subtotal * (pct.markup_pct / 100);
  const overhead = subtotal * (pct.overhead_pct / 100);
  const profit = subtotal * (pct.profit_pct / 100);
  const beforeTax = subtotal + markup + overhead + profit;
  const tax = beforeTax * (pct.tax_pct / 100);
  return {
    subtotal: r2(subtotal),
    markup: r2(markup),
    overhead: r2(overhead),
    profit: r2(profit),
    tax: r2(tax),
    total: r2(beforeTax + tax),
  };
}

export interface PerSquareMath {
  trueSqft: number;
  wastePct: number;
  withWasteSqft: number;
  squares: number;
  pricePerSquare: number;
  total: number;
  sentence: string;
}

export function perSquareMath(
  measurement: Record<string, unknown> | null,
  pricePerSquare: number,
): PerSquareMath {
  const trueSqft = n(measurement?.total_area_sqft) || n(measurement?.total_squares) * 100;
  const wastePct = n(measurement?.waste_pct) || 15;
  const withWasteSqft = Math.round(trueSqft * (1 + wastePct / 100));
  const squares = r2(withWasteSqft / 100);
  const total = r2(squares * pricePerSquare);
  const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return {
    trueSqft,
    wastePct,
    withWasteSqft,
    squares,
    pricePerSquare,
    total,
    sentence: `${fmt(trueSqft)} sf + ${wastePct}% waste = ${fmt(withWasteSqft)} sf = ${fmt(
      squares,
    )} SQ × $${fmt(pricePerSquare)} = $${fmt(total)}`,
  };
}

/* ------------------------------------------------------------------ */
/* save                                                                */
/* ------------------------------------------------------------------ */

export async function saveCbEstimate(args: {
  inputs: CbEstimateInputs;
  mode: CbEstimateMode;
  lines: CbDraftLine[];
  percents: CbEstimatePercents;
  pricePerSquare: number;
  attachToReport: boolean;
}): Promise<string> {
  const { inputs, mode, lines, percents, pricePerSquare, attachToReport } = args;
  const perSquare = mode === "per_square";
  const totals = computeTotals(lines, percents);
  const math = perSquareMath(inputs.measurement, pricePerSquare);

  const payload = {
    company_id: inputs.companyId,
    job_id: inputs.job.gc_job_id,
    cb_job_id: inputs.job.id,
    cb_mode: mode,
    price_per_square: perSquare ? pricePerSquare : null,
    name: `${inputs.job.customer_name || inputs.job.address || "Claim Buddy"} — ${
      perSquare ? "price per square" : "full estimate"
    }`,
    status: "draft" as const,
    tier: "good",
    hide_pricing: perSquare,
    use_manual_total: perSquare,
    manual_total: perSquare ? math.total : null,
    subtotal: perSquare ? math.total : totals.subtotal,
    tax: perSquare ? 0 : totals.tax,
    total: perSquare ? math.total : totals.total,
    markup_pct: perSquare ? 0 : percents.markup_pct,
    overhead_pct: perSquare ? 0 : percents.overhead_pct,
    profit_pct: perSquare ? 0 : percents.profit_pct,
    tax_pct: perSquare ? 0 : percents.tax_pct,
    notes: perSquare ? math.sentence : null,
    report_meta: { attach_to_report: attachToReport, cb_mode: mode } as never,
  };

  let estimateId = (inputs.existing?.estimate.id as string | undefined) ?? null;
  if (estimateId) {
    const { error } = await supabase.from("estimates").update(payload).eq("id", estimateId);
    if (error) throw error;
    await supabase.from("estimate_line_items").delete().eq("estimate_id", estimateId);
  } else {
    const { data, error } = await supabase.from("estimates").insert(payload).select("id").single();
    if (error) throw error;
    estimateId = data.id as string;
  }

  if (lines.length) {
    const rows = lines.map((l, i) => ({
      estimate_id: estimateId!,
      line_item_id: l.line_item_id,
      trade: (l.trade ?? "roofing") as never,
      code: l.code,
      name: l.name,
      unit: l.unit,
      qty: perSquare ? 0 : l.qty,
      unit_price: perSquare ? 0 : l.unit_price,
      total: perSquare ? 0 : r2(l.qty * l.unit_price),
      sort_order: i,
      source: l.source,
      category: l.category,
      note: l.basis || null,
    }));
    const { error } = await supabase.from("estimate_line_items").insert(rows);
    if (error) throw error;
  }

  if (perSquare && pricePerSquare > 0) {
    await supabase
      .from("cb_workspaces")
      .update({ default_price_per_square: pricePerSquare })
      .eq("id", inputs.job.workspace_id);
  }

  return estimateId!;
}
