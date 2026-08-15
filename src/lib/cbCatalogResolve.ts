/**
 * Claim Buddy estimate catalog — data resolution.
 *
 * An estimate is produced from THREE data inputs and zero hardcoded scope:
 *   1. cb_assemblies / cb_assembly_items   base package per roof system
 *   2. cb_item_mappings                    what the rep checked → price lines
 *   3. code_rule_sets / code_rule_items    jurisdiction, applied last
 *
 * Every resolution is stamped with the catalog version that produced it so a
 * signed estimate still reproduces months later.
 */
import { supabase } from "@/integrations/supabase/client";

export const CB_ROOF_SYSTEMS: { key: string; label: string; aliases: string[] }[] = [
  { key: "three_tab_shingle", label: "3-tab shingle", aliases: ["3-tab", "3 tab", "three tab"] },
  { key: "architectural_shingle", label: "Architectural shingle", aliases: ["architectural", "laminated", "dimensional", "impact-resistant", "luxury", "designer"] },
  { key: "concrete_tile", label: "Concrete tile", aliases: ["concrete tile"] },
  { key: "clay_tile", label: "Clay tile", aliases: ["clay tile", "barrel"] },
  { key: "standing_seam_metal", label: "Standing seam metal", aliases: ["standing seam"] },
  { key: "exposed_fastener_metal", label: "Exposed fastener metal", aliases: ["corrugated", "exposed fastener", "5v", "stone-coated"] },
  { key: "tpo", label: "TPO", aliases: ["tpo", "pvc", "epdm"] },
  { key: "modified_bitumen", label: "Modified bitumen", aliases: ["modified bitumen", "bur", "tar and gravel", "rolled roofing"] },
  { key: "spf_foam", label: "SPF foam", aliases: ["spf", "foam"] },
  { key: "coating_restoration", label: "Coating restoration", aliases: ["coating", "restoration"] },
];

export function normalizeRoofSystem(value: string | null | undefined): string | null {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return null;
  const exact = CB_ROOF_SYSTEMS.find((s) => s.key === v || s.label.toLowerCase() === v);
  if (exact) return exact.key;
  const hit = CB_ROOF_SYSTEMS.find((s) => s.aliases.some((a) => v.includes(a)));
  return hit?.key ?? null;
}

export function roofSystemLabel(key: string | null | undefined): string {
  return CB_ROOF_SYSTEMS.find((s) => s.key === key)?.label ?? (key ?? "—");
}

/* ------------------------------------------------------------------ */
/* quantity modes                                                      */
/* ------------------------------------------------------------------ */

export const CB_QTY_MODES: { value: string; label: string }[] = [
  { value: "fixed", label: "Fixed count" },
  { value: "per_square", label: "Per square (with waste)" },
  { value: "per_sf", label: "Per SF of roof area" },
  { value: "per_lf_eave", label: "Per LF of eave" },
  { value: "per_lf_rake", label: "Per LF of rake" },
  { value: "per_lf_ridge", label: "Per LF of ridge" },
  { value: "per_lf_hip", label: "Per LF of hip" },
  { value: "per_lf_ridge_hip", label: "Per LF of ridge + hip" },
  { value: "per_lf_valley", label: "Per LF of valley" },
  { value: "per_lf_perimeter", label: "Per LF of perimeter (eave + rake)" },
  { value: "per_lf_step", label: "Per LF of step flashing" },
  { value: "per_lf_wall", label: "Per LF of wall flashing" },
  { value: "per_ea", label: "Per EA counted by the rep" },
  { value: "per_opening", label: "Per opening" },
  { value: "per_elevation", label: "Per elevation" },
  { value: "per_room", label: "Per room" },
];

export interface CbQtyContext {
  squares: number;
  area_sqft: number;
  eave_lf: number;
  rake_lf: number;
  ridge_lf: number;
  hip_lf: number;
  valley_lf: number;
  step_lf: number;
  wall_lf: number;
  openings: number;
  elevations: number;
  rooms: number;
}

const n = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export function qtyForMode(
  mode: string,
  factor: number,
  ctx: CbQtyContext,
  count = 1,
): { qty: number; basis: string } {
  const f = factor || 1;
  switch ((mode || "fixed").toLowerCase()) {
    case "per_square":
      return { qty: f * ctx.squares, basis: `${f} per SQ × ${r2(ctx.squares)} SQ` };
    case "per_sf":
      return { qty: f * ctx.area_sqft, basis: `${f} per SF × ${r2(ctx.area_sqft)} SF` };
    case "per_lf_eave":
      return { qty: f * ctx.eave_lf, basis: `Eave ${r2(ctx.eave_lf)} LF` };
    case "per_lf_rake":
      return { qty: f * ctx.rake_lf, basis: `Rake ${r2(ctx.rake_lf)} LF` };
    case "per_lf_ridge":
      return { qty: f * ctx.ridge_lf, basis: `Ridge ${r2(ctx.ridge_lf)} LF` };
    case "per_lf_hip":
      return { qty: f * ctx.hip_lf, basis: `Hip ${r2(ctx.hip_lf)} LF` };
    case "per_lf_ridge_hip":
      return { qty: f * (ctx.ridge_lf + ctx.hip_lf), basis: `Ridge + hip ${r2(ctx.ridge_lf + ctx.hip_lf)} LF` };
    case "per_lf_valley":
      return { qty: f * ctx.valley_lf, basis: `Valley ${r2(ctx.valley_lf)} LF` };
    case "per_lf_perimeter":
      return { qty: f * (ctx.eave_lf + ctx.rake_lf), basis: `Perimeter ${r2(ctx.eave_lf + ctx.rake_lf)} LF` };
    case "per_lf_step":
      return { qty: f * ctx.step_lf, basis: `Step flashing ${r2(ctx.step_lf)} LF` };
    case "per_lf_wall":
      return { qty: f * ctx.wall_lf, basis: `Wall flashing ${r2(ctx.wall_lf)} LF` };
    case "per_ea":
      return { qty: f * (count || 0), basis: `${count} counted on the walk` };
    case "per_opening":
      return { qty: f * (ctx.openings || count || 0), basis: `${ctx.openings || count} openings` };
    case "per_elevation":
      return { qty: f * (ctx.elevations || 1), basis: `${ctx.elevations || 1} elevations` };
    case "per_room":
      return { qty: f * (ctx.rooms || 1), basis: `${ctx.rooms || 1} rooms` };
    default:
      return { qty: f, basis: `Fixed quantity ${f}` };
  }
}

/* ------------------------------------------------------------------ */
/* types                                                               */
/* ------------------------------------------------------------------ */

export interface CbCatalogVersion {
  id: string;
  company_id: string | null;
  note: string | null;
  is_current: boolean;
  created_at: string;
}

export interface CbAssemblyRow {
  id: string;
  version_id: string;
  roof_system: string;
  name: string;
  is_active: boolean;
}

export interface CbAssemblyItemRow {
  id: string;
  assembly_id: string;
  line_item_id: string | null;
  role: string | null;
  qty_mode: string;
  qty_factor: number;
  waste_pct: number;
  note: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface CbItemMappingRow {
  id: string;
  version_id: string;
  catalog_item_id: string;
  roof_system: string | null;
  line_item_id: string | null;
  qty_mode: string;
  qty_factor: number;
  waste_pct: number;
  note: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface CbCatalogLineItem {
  id: string;
  code: string | null;
  name: string;
  unit: string | null;
  trade: string | null;
  category: string | null;
  waste_pct: number | null;
  default_price: number | null;
  company_id: string | null;
}

/* ------------------------------------------------------------------ */
/* loaders                                                             */
/* ------------------------------------------------------------------ */

/** The version an estimate should be built against right now. */
export async function loadCurrentCatalogVersion(companyId?: string | null): Promise<CbCatalogVersion | null> {
  if (companyId) {
    const { data } = await supabase
      .from("cb_catalog_versions")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_current", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as CbCatalogVersion;
  }
  const { data } = await supabase
    .from("cb_catalog_versions")
    .select("*")
    .is("company_id", null)
    .eq("is_current", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as CbCatalogVersion) ?? null;
}

export async function listCatalogVersions(): Promise<CbCatalogVersion[]> {
  const { data } = await supabase
    .from("cb_catalog_versions")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as CbCatalogVersion[];
}

/**
 * Editing never mutates a published version. Clone the current version, then
 * edit the clone and make it current — historical estimates keep resolving
 * against the version stamped on them.
 */
export async function cloneCatalogVersion(
  sourceId: string,
  note: string,
  companyId: string | null = null,
): Promise<string> {
  const { data: created, error } = await supabase
    .from("cb_catalog_versions")
    .insert({ note, company_id: companyId, is_current: false })
    .select("id")
    .single();
  if (error || !created) throw error ?? new Error("Could not create catalog version");
  const newId = created.id as string;

  const { data: asms } = await supabase.from("cb_assemblies").select("*").eq("version_id", sourceId);
  const idMap = new Map<string, string>();
  for (const a of (asms ?? []) as CbAssemblyRow[]) {
    const { data: copy } = await supabase
      .from("cb_assemblies")
      .insert({ version_id: newId, roof_system: a.roof_system, name: a.name, is_active: a.is_active })
      .select("id")
      .single();
    if (copy) idMap.set(a.id, copy.id as string);
  }
  const oldAsmIds = (asms ?? []).map((a) => a.id);
  if (oldAsmIds.length) {
    const { data: aItems } = await supabase.from("cb_assembly_items").select("*").in("assembly_id", oldAsmIds);
    const rows = ((aItems ?? []) as CbAssemblyItemRow[])
      .filter((i) => idMap.has(i.assembly_id))
      .map((i) => ({
        assembly_id: idMap.get(i.assembly_id)!,
        line_item_id: i.line_item_id,
        role: i.role,
        qty_mode: i.qty_mode,
        qty_factor: i.qty_factor,
        waste_pct: i.waste_pct,
        note: i.note,
        is_active: i.is_active,
        sort_order: i.sort_order,
      }));
    if (rows.length) await supabase.from("cb_assembly_items").insert(rows);
  }

  const { data: maps } = await supabase.from("cb_item_mappings").select("*").eq("version_id", sourceId);
  const mapRows = ((maps ?? []) as CbItemMappingRow[]).map((m) => ({
    version_id: newId,
    catalog_item_id: m.catalog_item_id,
    roof_system: m.roof_system,
    line_item_id: m.line_item_id,
    qty_mode: m.qty_mode,
    qty_factor: m.qty_factor,
    waste_pct: m.waste_pct,
    note: m.note,
    is_active: m.is_active,
    sort_order: m.sort_order,
  }));
  if (mapRows.length) await supabase.from("cb_item_mappings").insert(mapRows);

  return newId;
}

export async function makeVersionCurrent(versionId: string, companyId: string | null = null) {
  const q = supabase.from("cb_catalog_versions").update({ is_current: false });
  if (companyId) await q.eq("company_id", companyId);
  else await q.is("company_id", null);
  await supabase.from("cb_catalog_versions").update({ is_current: true }).eq("id", versionId);
}

export async function loadAssemblies(versionId: string): Promise<CbAssemblyRow[]> {
  const { data } = await supabase
    .from("cb_assemblies")
    .select("*")
    .eq("version_id", versionId)
    .order("roof_system");
  return (data ?? []) as CbAssemblyRow[];
}

export async function loadAssemblyItems(assemblyIds: string[]): Promise<CbAssemblyItemRow[]> {
  if (!assemblyIds.length) return [];
  const { data } = await supabase
    .from("cb_assembly_items")
    .select("*")
    .in("assembly_id", assemblyIds)
    .order("sort_order");
  return (data ?? []) as CbAssemblyItemRow[];
}

export async function loadItemMappings(versionId: string): Promise<CbItemMappingRow[]> {
  const { data } = await supabase
    .from("cb_item_mappings")
    .select("*")
    .eq("version_id", versionId)
    .order("sort_order");
  return (data ?? []) as CbItemMappingRow[];
}

export async function loadLineItems(ids: string[]): Promise<Map<string, CbCatalogLineItem>> {
  const out = new Map<string, CbCatalogLineItem>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  for (let i = 0; i < unique.length; i += 200) {
    const { data } = await supabase
      .from("line_item_master")
      .select("id, code, name, unit, trade, category, waste_pct, default_price, company_id")
      .in("id", unique.slice(i, i + 200));
    for (const row of data ?? []) out.set(row.id, row as CbCatalogLineItem);
  }
  return out;
}

/** Search the price book for the admin + rep pickers. */
export async function searchLineItems(term: string, trade?: string | null): Promise<CbCatalogLineItem[]> {
  const t = term.trim();
  let q = supabase
    .from("line_item_master")
    .select("id, code, name, unit, trade, category, waste_pct, default_price, company_id")
    .limit(40);
  if (trade) q = q.eq("trade", trade);
  if (t) q = q.or(`code.ilike.%${t}%,name.ilike.%${t}%`);
  const { data } = await q;
  return (data ?? []) as CbCatalogLineItem[];
}

/* ------------------------------------------------------------------ */
/* resolution                                                          */
/* ------------------------------------------------------------------ */

export interface CbResolvedLine {
  line_item_id: string | null;
  code: string | null;
  name: string;
  unit: string;
  qty: number;
  trade: string | null;
  category: string | null;
  source: "assembly" | "takeoff";
  basis: string;
  waste_pct: number;
  default_price: number;
}

export interface CbCatalogResolution {
  version: CbCatalogVersion | null;
  assembly: CbAssemblyRow | null;
  lines: CbResolvedLine[];
  /** Checked catalog items that have no mapping for this roof system. */
  unmapped: string[];
  error: string | null;
}

/**
 * Build the estimate scope from data alone.
 * `checked` is catalog_item_id → counted quantity from the takeoff walk.
 */
export async function resolveCatalogScope(args: {
  roofSystemKey: string | null;
  ctx: CbQtyContext;
  checked: Record<string, number>;
  companyId?: string | null;
  versionId?: string | null;
}): Promise<CbCatalogResolution> {
  const version = args.versionId
    ? ((
        await supabase.from("cb_catalog_versions").select("*").eq("id", args.versionId).maybeSingle()
      ).data as CbCatalogVersion | null)
    : await loadCurrentCatalogVersion(args.companyId ?? null);

  if (!version) {
    return { version: null, assembly: null, lines: [], unmapped: [], error: "No estimate catalog has been published yet." };
  }
  if (!args.roofSystemKey) {
    return { version, assembly: null, lines: [], unmapped: [], error: "No roof system recorded on the takeoff — the estimate cannot be built." };
  }

  const assemblies = await loadAssemblies(version.id);
  const assembly = assemblies.find((a) => a.roof_system === args.roofSystemKey && a.is_active) ?? null;
  if (!assembly) {
    return {
      version,
      assembly: null,
      lines: [],
      unmapped: [],
      error: `No assembly is defined for ${roofSystemLabel(args.roofSystemKey)} in this catalog version.`,
    };
  }

  const aItems = (await loadAssemblyItems([assembly.id])).filter((i) => i.is_active);
  const mappings = (await loadItemMappings(version.id)).filter((m) => m.is_active);

  const lineIds = [
    ...aItems.map((i) => i.line_item_id),
    ...mappings.map((m) => m.line_item_id),
  ].filter(Boolean) as string[];
  const masters = await loadLineItems(lineIds);

  const lines: CbResolvedLine[] = [];
  const push = (
    master: CbCatalogLineItem | undefined,
    qty: number,
    waste: number,
    source: CbResolvedLine["source"],
    basis: string,
  ) => {
    if (!master || qty <= 0) return;
    const withWaste = qty * (1 + n(waste) / 100);
    lines.push({
      line_item_id: master.id,
      code: master.code,
      name: master.name,
      unit: (master.unit ?? "EA").toUpperCase(),
      qty: r2(withWaste),
      trade: master.trade,
      category: master.category,
      source,
      basis: waste > 0 ? `${basis} + ${waste}% waste` : basis,
      waste_pct: n(waste),
      default_price: n(master.default_price),
    });
  };

  /* 1 — base assembly */
  for (const item of aItems) {
    const master = item.line_item_id ? masters.get(item.line_item_id) : undefined;
    const { qty, basis } = qtyForMode(item.qty_mode, n(item.qty_factor), args.ctx);
    push(master, qty, n(item.waste_pct), "assembly", `${assembly.name} — ${basis}`);
  }

  /* 2 — item mappings for what the rep checked, system override beats default */
  const unmapped: string[] = [];
  for (const [catalogItemId, count] of Object.entries(args.checked)) {
    const forItem = mappings.filter((m) => m.catalog_item_id === catalogItemId);
    if (!forItem.length) {
      unmapped.push(catalogItemId);
      continue;
    }
    const overrides = forItem.filter((m) => m.roof_system === args.roofSystemKey);
    const use = overrides.length ? overrides : forItem.filter((m) => !m.roof_system);
    if (!use.length) {
      unmapped.push(catalogItemId);
      continue;
    }
    for (const m of use) {
      const master = m.line_item_id ? masters.get(m.line_item_id) : undefined;
      const { qty, basis } = qtyForMode(m.qty_mode, n(m.qty_factor), args.ctx, count);
      push(master, qty, n(m.waste_pct), "takeoff", `Checked on the walk — ${basis}${m.note ? ` · ${m.note}` : ""}`);
    }
  }

  return { version, assembly, lines, unmapped, error: null };
}

/* ------------------------------------------------------------------ */
/* coverage                                                            */
/* ------------------------------------------------------------------ */

export interface CbCoverageRow {
  scope: string;
  total: number;
  mapped: number;
  missing: { id: string; label: string }[];
}

export async function catalogCoverage(versionId: string, roofSystem: string | null): Promise<CbCoverageRow[]> {
  const { data: catalog } = await supabase
    .from("cb_item_catalog")
    .select("id, scope, label")
    .eq("active", true);
  const mappings = (await loadItemMappings(versionId)).filter((m) => m.is_active);
  const covered = new Set(
    mappings
      .filter((m) => !roofSystem || !m.roof_system || m.roof_system === roofSystem)
      .map((m) => m.catalog_item_id),
  );
  const byScope = new Map<string, CbCoverageRow>();
  for (const row of catalog ?? []) {
    const scope = row.scope as string;
    const entry = byScope.get(scope) ?? { scope, total: 0, mapped: 0, missing: [] };
    entry.total += 1;
    if (covered.has(row.id)) entry.mapped += 1;
    else entry.missing.push({ id: row.id, label: row.label as string });
    byScope.set(scope, entry);
  }
  return Array.from(byScope.values()).sort((a, b) => a.scope.localeCompare(b.scope));
}
