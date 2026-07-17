// Verbatim data tables from SPF Scope & Cost Engine HTML source.
// PRODUCTS / DETAILS_SEED / STACKS / FIELD_DEFAULTS are seeded from the admin
// backend at runtime via hydrateCatalog(). The arrays below are the fallback
// used before the DB fetch resolves and match the DB seed exactly.

// [name, solids%, $/gal, default mils, default method, role]
export type Product = [string, number, number, number, MethodKey, ProductRole];
export type ProductRole = "primer" | "detail" | "base" | "top";
export type MethodKey = "spray" | "roll" | "brush";

export const PRODUCTS: Product[] = [
  ["Rust-inhibitive primer (metal)", 45, 38, 3, "roll", "primer"],
  ["Epoxy primer", 65, 62, 4, "spray", "primer"],
  ["Bleed-block / stain primer", 40, 42, 3, "spray", "primer"],
  ["SPF tie coat / adhesion primer", 50, 40, 3, "spray", "primer"],
  ["Butyl rubber seam sealant", 60, 48, 20, "brush", "detail"],
  ["Mastic / detail cement", 80, 34, 60, "brush", "detail"],
  ["Acrylic base coat", 52, 19, 15, "spray", "base"],
  ["Acrylic top coat — high solids", 62, 26, 15, "spray", "top"],
  ["Silicone base coat", 92, 44, 12, "spray", "base"],
  ["Silicone top coat — high solids", 98, 52, 12, "spray", "top"],
  ["Silicone — single coat", 98, 52, 24, "spray", "base"],
  ["Polyurethane base — aromatic", 70, 58, 12, "spray", "base"],
  ["Polyurethane top — aliphatic", 65, 72, 8, "spray", "top"],
  ["Polyurea", 100, 78, 40, "spray", "base"],
  ["Rubber / butyl coating", 60, 46, 25, "spray", "base"],
  ["Aluminum reflective coating", 45, 32, 10, "roll", "top"],
  ["Custom product", 100, 50, 20, "spray", "base"],
];

// [label, sqft/day, extraWaste%]
export const METHODS: Record<MethodKey, [string, number, number]> = {
  spray: ["Spray", 9000, 0],
  roll: ["Roll", 3500, 12],
  brush: ["Brush", 900, 8],
};

export type ScopeKey = "field" | "pct" | "seams" | "details" | "custom";
export const SCOPES: Record<ScopeKey, string> = {
  field: "Full field",
  pct: "% of field",
  seams: "Seams (LF)",
  details: "Details only",
  custom: "Custom sq ft",
};

// LAYER tuple: [on, productIdx, name, scope, amount, method, mils, solids, cost, waste]
export type Layer = [
  number,         // on (0/1)
  number,         // product index
  string | null,  // name override
  ScopeKey,       // scope
  number,         // amount
  MethodKey,      // method
  number,         // mils
  number | null,  // solids %
  number | null,  // $/gal
  number | null,  // waste %
];

// [on, productIdx, name, scope, amount, method, mils, solids, cost, waste]
type StackTemplate = [number, number, null, ScopeKey, number, MethodKey, number, null, null, null][];
export const STACKS: Record<string, StackTemplate> = {
  sil2: [
    [1, 9, null, "field", 100, "spray", 12, null, null, null],
    [1, 10, null, "field", 100, "spray", 12, null, null, null],
  ],
  sil1: [[1, 10, null, "field", 100, "spray", 24, null, null, null]],
  acr2: [
    [1, 6, null, "field", 100, "spray", 15, null, null, null],
    [1, 7, null, "field", 100, "spray", 15, null, null, null],
  ],
  rust: [
    [1, 0, null, "field", 100, "roll", 3, null, null, null],
    [1, 4, null, "seams", 0, "brush", 20, null, null, null],
    [1, 6, null, "field", 100, "spray", 15, null, null, null],
    [1, 7, null, "field", 100, "spray", 15, null, null, null],
  ],
  pu: [
    [1, 11, null, "field", 100, "spray", 12, null, null, null],
    [1, 12, null, "field", 100, "spray", 8, null, null, null],
  ],
};

// [label, unit, qty, unit-cost]
export type Detail = [string, "ea" | "lf" | "ls", number, number];
export const DETAILS_SEED: Detail[] = [
  ["Small penetration (<4\" pipe)", "ea", 0, 95],
  ["Large penetration / cluster", "ea", 0, 240],
  ["Pitch pan — new, filled", "ea", 0, 185],
  ["Roof drain — reset & flash", "ea", 0, 420],
  ["Drain replacement", "ea", 0, 1150],
  ["Scupper / thru-wall", "ea", 0, 275],
  ["HVAC curb — flash around", "ea", 0, 310],
  ["HVAC unit — lift, foam under, re-set", "ea", 0, 1450],
  ["Exhaust fan / vent curb", "ea", 0, 225],
  ["Skylight — flash perimeter", "ea", 0, 340],
  ["Skylight replacement", "ea", 0, 1600],
  ["Roof hatch — flash", "ea", 0, 290],
  ["Equipment / pipe support — raise & block", "ea", 0, 165],
  ["Satellite / antenna base", "ea", 0, 275],
  ["Lightning protection — detach & reset", "ea", 0, 0],
  ["Solar array — detach & reset (per panel)", "ea", 0, 0],
  ["Rusted fastener — treat / replace", "ea", 0, 4.5],
  ["Parapet / curb wall — foam & coat", "lf", 0, 11],
  ["Wall termination bar + sealant", "lf", 0, 7.5],
  ["Counterflashing — new metal", "lf", 0, 14],
  ["Edge metal / drip edge — new", "lf", 0, 12],
  ["Coping cap — new", "lf", 0, 26],
  ["Gutter / downspout", "lf", 0, 18],
  ["Expansion joint — new cover", "lf", 0, 42],
  ["Ridge / hip seam detail (metal)", "lf", 0, 4.5],
  ["Walkway pad / granule path", "lf", 0, 9],
  ["Crickets — sheet metal", "ea", 0, 285],
  ["Tie-in to adjacent roof", "lf", 0, 22],
  ["Fall protection anchor / warning line", "ls", 0, 0],
];

// All field defaults, mirroring the HTML input/select defaults verbatim.
export type SpfFields = {
  // Project
  p_name: string; p_addr: string; p_sqft: number; p_areawaste: number;
  p_geo: string; p_slope: string;
  // Existing
  e_deck: string; e_surf: string; e_layers: number; e_tear: string;
  e_tearcost: number; e_disp: number; e_deckrep: number; e_deckrepc: number;
  e_prep: string; e_rustpct: number; e_rustm: string;
  e_mildew: number; e_fast: number; e_dry: number;
  // Access
  a_ht: number; a_hose: number; a_method: string;
  a_liftrate: number; a_liftdays: number; a_liftdel: number;
  a_cranerate: number; a_cranehrs: number; a_hoist: number;
  a_occ: string; a_overspray: number; a_screens: number; a_shift: string;
  // Foam
  f_on: string; f_dens: string; f_thick: number; f_taper: number;
  f_yield: number; f_waste: number; f_cost: number; f_freight: number;
  f_amb: string; f_tex: string;
  // Reinforcement
  r_lf: number; r_w: number; r_type: string; r_c: number;
  r_rate: number; r_fieldpct: number; r_fieldc: number;
  // Labor
  l_foamrate: number; l_preprate: number; l_rustrate: number; l_tearrate: number;
  l_crew: number; l_wage: number; l_hrs: number; l_burden: number;
  l_mobs: number; l_mobc: number; l_diem: number; l_lodge: number;
  l_wx: number; l_super: number;
  // Equipment
  q_rig: number; q_fuel: number; q_pump: number; q_wash: number;
  q_cons: number; q_hand: number; q_dump: number; q_dumpc: number;
  q_trailer: number; q_veh: number;
  // Soft
  s_eng: string; s_engov: number; s_pbasis: "pct" | "flat";
  s_ppct: number; s_pflat: number; s_plan: number;
  s_insp: number; s_inspc: number; s_noa: number; s_ir: number;
  s_core: number; s_mock: number; s_3rd: number;
  s_war: string; s_warfee: number;
  // Markups
  m_tax: number; m_cont: number; m_gl: number; m_bond: number;
  m_oh: number; m_comm: number; m_margin: number; m_fin: number;
};

export const FIELD_DEFAULTS: SpfFields = {
  p_name: "Untitled Commercial SPF", p_addr: "", p_sqft: 20000, p_areawaste: 3,
  p_geo: "1.10", p_slope: "1.00",
  e_deck: "steel", e_surf: "burs", e_layers: 1, e_tear: "0",
  e_tearcost: 115, e_disp: 45, e_deckrep: 0, e_deckrepc: 14,
  e_prep: "0.22", e_rustpct: 0, e_rustm: "0.35",
  e_mildew: 0, e_fast: 0, e_dry: 0,
  a_ht: 24, a_hose: 200, a_method: "1",
  a_liftrate: 0, a_liftdays: 0, a_liftdel: 0,
  a_cranerate: 285, a_cranehrs: 0, a_hoist: 0,
  a_occ: "1.00", a_overspray: 1200, a_screens: 0, a_shift: "1.00",
  f_on: "1", f_dens: "3.0", f_thick: 1.5, f_taper: 0,
  f_yield: 4000, f_waste: 12, f_cost: 2150, f_freight: 85,
  f_amb: "1.00", f_tex: "18",
  r_lf: 0, r_w: 6, r_type: "0.42", r_c: 0,
  r_rate: 600, r_fieldpct: 0, r_fieldc: 0.42,
  l_foamrate: 5000, l_preprate: 12000, l_rustrate: 2500, l_tearrate: 18,
  l_crew: 4, l_wage: 34, l_hrs: 9, l_burden: 34,
  l_mobs: 1, l_mobc: 1400, l_diem: 0, l_lodge: 0,
  l_wx: 1, l_super: 380,
  q_rig: 450, q_fuel: 140, q_pump: 95, q_wash: 65,
  q_cons: 185, q_hand: 0, q_dump: 0, q_dumpc: 695,
  q_trailer: 0, q_veh: 90,
  s_eng: "2500", s_engov: 0, s_pbasis: "pct",
  s_ppct: 2.2, s_pflat: 425, s_plan: 350,
  s_insp: 3, s_inspc: 0, s_noa: 0, s_ir: 0,
  s_core: 450, s_mock: 0, s_3rd: 0,
  s_war: "0.12", s_warfee: 0,
  m_tax: 7, m_cont: 4, m_gl: 1.6, m_bond: 0,
  m_oh: 11, m_comm: 6, m_margin: 28, m_fin: 0,
};

// Labels for select options (used in scope-builder text output)
export const DECK_LABELS: Record<string, string> = {
  concrete: "structural concrete", lwic: "lightweight insulating concrete",
  steel: "steel", metalpanel: "metal panel", wood: "wood", gypsum: "gypsum",
};
export const SURF_LABELS: Record<string, string> = {
  bur: "gravel-surfaced built-up roof",
  burs: "smooth-surfaced BUR/modified bitumen",
  single: "single-ply membrane",
  spf: "existing sprayed polyurethane foam",
  metal: "exposed metal panel",
  none: "bare deck",
};
export const ACCESS_LABELS = [
  "interior stair/hoist access",
  "ladder and material conveyor",
  "scissor lift",
  "boom lift/telehandler",
  "crane pick",
  "crane-set rooftop rig",
];

// Human-readable labels for select values referenced in the scope text.
export const PREP_LABELS: Record<string, string> = {
  "0.06": "Blow / broom clean only",
  "0.22": "Power wash + detergent",
  "0.38": "Hot wash + degreaser (grease/kitchen)",
  "0.55": "Grind / scarify + wash",
};
export const RUST_LABELS: Record<string, string> = {
  "0.35": "Wire wheel / hand tool (SSPC-SP3)",
  "0.85": "Power tool to bare metal (SP11)",
  "1.40": "Abrasive blast (SP6 commercial)",
};
export const FABRIC_LABELS: Record<string, string> = {
  "0.42": "Polyester fabric",
  "0.55": "Fiberglass mat",
  "0.95": "Butyl / seam tape",
};
export const ENG_LABELS: Record<string, string> = {
  "0": "None",
  "2500": "Wind uplift letter / FBC calcs",
  "4800": "Calcs + structural review",
  "9500": "Full sealed drawings + structural",
};
export const WAR_LABELS: Record<string, string> = {
  "0": "Contractor workmanship only",
  "0.12": "10-yr manufacturer NDL",
  "0.18": "15-yr NDL",
  "0.26": "20-yr NDL",
};

// ---------- Runtime hydration from admin catalog (DB) ----------
// Mutate the arrays/objects in place so existing `import { PRODUCTS }` bindings
// see the fresh data without any refactor across engine.ts and presets.ts.
export function hydrateCatalog(next: {
  products?: Product[];
  details?: Detail[];
  stacks?: Record<string, StackTemplate>;
  fieldDefaults?: Partial<SpfFields>;
}) {
  if (next.products && next.products.length) {
    PRODUCTS.splice(0, PRODUCTS.length, ...next.products);
  }
  if (next.details) {
    DETAILS_SEED.splice(0, DETAILS_SEED.length, ...next.details);
  }
  if (next.stacks) {
    for (const k of Object.keys(STACKS)) delete (STACKS as Record<string, StackTemplate>)[k];
    Object.assign(STACKS, next.stacks);
  }
  if (next.fieldDefaults) {
    Object.assign(FIELD_DEFAULTS, next.fieldDefaults);
  }
}

