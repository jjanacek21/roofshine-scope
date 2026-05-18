// Roof system templates — what line items to add to an estimate for each
// detected roof system, with qty formulas based on measurements.
// Used by /api/build-roof-estimate to compose the deduped roof estimate.

export type RoofSystem =
  | "laminated_shingle"
  | "3tab_shingle"
  | "concrete_tile"
  | "clay_tile"
  | "metal_standing_seam"
  | "metal_screw_down"
  | "modified_bitumen"
  | "tpo"
  | "epdm"
  | "spf"
  | "coating";

export type Measurements = {
  squares: number;
  eaves_lf: number;
  rakes_lf: number;
  ridges_lf: number;
  hips_lf: number;
  valleys_lf: number;
  gutters_lf: number;
  pipe_count: number;
  has_ridge_vent: boolean;
  has_off_ridge_vents: boolean;
  off_ridge_vent_count: number;
  has_gutters: boolean;
};

export type SystemItem = {
  code: string;
  qty: number;
  unit: string;
};

type Rule = {
  code: string;
  unit: string;
  qty: (m: Measurements) => number;
  when?: (m: Measurements) => boolean;
};

const SHINGLE_COMMON: Rule[] = [
  { code: "RFG-STARTER",    unit: "LF", qty: (m) => m.eaves_lf + m.rakes_lf },
  { code: "RFG-HIPRIDGE",   unit: "LF", qty: (m) => m.hips_lf + m.ridges_lf },
  { code: "RFG-DRIPEDGE",   unit: "LF", qty: (m) => m.eaves_lf + m.rakes_lf },
  { code: "RFG-RIDGEVENT",  unit: "LF", qty: (m) => m.ridges_lf, when: (m) => m.has_ridge_vent },
  { code: "RFG-OFFRIDGE",   unit: "EA", qty: (m) => Math.max(m.off_ridge_vent_count, 1), when: (m) => m.has_off_ridge_vents },
  { code: "RFG-PIPEBOOT",   unit: "EA", qty: (m) => Math.max(m.pipe_count, 1) },
  { code: "RFG-VALLEY",     unit: "LF", qty: (m) => m.valleys_lf, when: (m) => m.valleys_lf > 0 },
  { code: "EXT-GUTTER-6",   unit: "LF", qty: (m) => m.eaves_lf, when: (m) => m.has_gutters },
];

const TILE_COMMON: Rule[] = [
  { code: "RFG-TILE-START", unit: "LF", qty: (m) => m.eaves_lf },
  { code: "RFG-TILE-RIDGE", unit: "LF", qty: (m) => m.hips_lf + m.ridges_lf },
  { code: "RFG-TILE-BATTEN",unit: "SQ", qty: (m) => m.squares },
  { code: "RFG-DRIPEDGE",   unit: "LF", qty: (m) => m.eaves_lf + m.rakes_lf },
  { code: "RFG-PIPEBOOT",   unit: "EA", qty: (m) => Math.max(m.pipe_count, 1) },
  { code: "RFG-VALLEY",     unit: "LF", qty: (m) => m.valleys_lf, when: (m) => m.valleys_lf > 0 },
  { code: "EXT-GUTTER-6",   unit: "LF", qty: (m) => m.eaves_lf, when: (m) => m.has_gutters },
];

const METAL_COMMON: Rule[] = [
  { code: "RFG-METAL-CLOS", unit: "LF", qty: (m) => m.eaves_lf + m.ridges_lf + m.hips_lf },
  { code: "RFG-METAL-RIDGE",unit: "LF", qty: (m) => m.hips_lf + m.ridges_lf },
  { code: "RFG-DRIPEDGE",   unit: "LF", qty: (m) => m.eaves_lf + m.rakes_lf },
  { code: "RFG-PIPEBOOT",   unit: "EA", qty: (m) => Math.max(m.pipe_count, 1) },
  { code: "EXT-GUTTER-6",   unit: "LF", qty: (m) => m.eaves_lf, when: (m) => m.has_gutters },
];

const MODBIT_COMMON: Rule[] = [
  { code: "RFG-MODBIT-BASE",unit: "SQ", qty: (m) => m.squares },
  { code: "RFG-MODBIT-EDGE",unit: "LF", qty: (m) => m.eaves_lf + m.rakes_lf },
  { code: "RFG-MODBIT-WALK",unit: "EA", qty: () => 2 },
  { code: "RFG-PIPEBOOT",   unit: "EA", qty: (m) => Math.max(m.pipe_count, 1) },
];

export const ROOF_SYSTEM_TEMPLATES: Record<RoofSystem, { field: Rule; extras: Rule[] }> = {
  laminated_shingle: { field: { code: "RFG-LAM-COMP", unit: "SQ", qty: (m) => m.squares }, extras: SHINGLE_COMMON },
  "3tab_shingle":    { field: { code: "RFG-LAM-COMP", unit: "SQ", qty: (m) => m.squares }, extras: SHINGLE_COMMON },
  concrete_tile:     { field: { code: "RFG-TILE-CONC",unit: "SQ", qty: (m) => m.squares }, extras: TILE_COMMON },
  clay_tile:         { field: { code: "RFG-TILE-CLAY",unit: "SQ", qty: (m) => m.squares }, extras: TILE_COMMON },
  metal_standing_seam:{field: { code: "RFG-METAL-SS",  unit: "SQ", qty: (m) => m.squares }, extras: METAL_COMMON },
  metal_screw_down:  { field: { code: "RFG-METAL-SD",  unit: "SQ", qty: (m) => m.squares }, extras: METAL_COMMON },
  modified_bitumen:  { field: { code: "RFG-MODBIT-CAP",unit: "SQ", qty: (m) => m.squares }, extras: MODBIT_COMMON },
  tpo:               { field: { code: "RFG-MODBIT-CAP",unit: "SQ", qty: (m) => m.squares }, extras: MODBIT_COMMON },
  epdm:              { field: { code: "RFG-MODBIT-CAP",unit: "SQ", qty: (m) => m.squares }, extras: MODBIT_COMMON },
  spf:               { field: { code: "RFG-MODBIT-CAP",unit: "SQ", qty: (m) => m.squares }, extras: MODBIT_COMMON },
  coating:           { field: { code: "RFG-MODBIT-CAP",unit: "SQ", qty: (m) => m.squares }, extras: [] },
};

export function buildSystemItems(system: RoofSystem, m: Measurements): SystemItem[] {
  const tpl = ROOF_SYSTEM_TEMPLATES[system];
  if (!tpl) return [];
  const items: SystemItem[] = [];
  const all: Rule[] = [tpl.field, ...tpl.extras];
  for (const r of all) {
    if (r.when && !r.when(m)) continue;
    const qty = Math.round(r.qty(m) * 100) / 100;
    if (qty <= 0) continue;
    items.push({ code: r.code, qty, unit: r.unit });
  }
  return items;
}

export const FL_CODE_ITEMS: Rule[] = [
  { code: "FL-FELT-30-DBL", unit: "SQ", qty: (m) => m.squares },
  { code: "FL-PERIM-BUTYL", unit: "LF", qty: (m) => m.eaves_lf + m.rakes_lf },
  { code: "FL-RENAIL",      unit: "SQ", qty: (m) => m.squares },
  { code: "FL-PERMIT",      unit: "EA", qty: () => 1 },
];

export function buildFlCodeItems(m: Measurements): SystemItem[] {
  return FL_CODE_ITEMS
    .map((r) => ({ code: r.code, unit: r.unit, qty: Math.round(r.qty(m) * 100) / 100 }))
    .filter((it) => it.qty > 0);
}
