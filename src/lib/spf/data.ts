// Shared SPF types, method/scope tables and display labels.
// PRODUCTS / DETAILS_SEED / STACKS / FIELD_DEFAULTS hold NO hardcoded catalog
// data — they start empty and are filled per company via hydrateCatalog() from
// the company-scoped spf_* tables. No cross-company pricing fallback exists.

// [name, solids%, $/gal, default mils, default method, role]
export type Product = [string, number, number, number, MethodKey, ProductRole];
export type ProductRole = "primer" | "detail" | "base" | "top";
export type MethodKey = "spray" | "roll" | "brush";

export const PRODUCTS: Product[] = [];

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
export const STACKS: Record<string, StackTemplate> = {};

// [label, unit, qty, unit-cost]
export type Detail = [string, "ea" | "lf" | "ls", number, number];
export const DETAILS_SEED: Detail[] = [];

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

// Structural zero-state only — every value below is a neutral placeholder, not
// a price. Real values come from the company's own spf_field_defaults rows.
export const FIELD_DEFAULTS: SpfFields = {
  p_name: "", p_addr: "", p_sqft: 0, p_areawaste: 0,
  p_geo: "1.00", p_slope: "1.00",
  e_deck: "steel", e_surf: "burs", e_layers: 0, e_tear: "0",
  e_tearcost: 0, e_disp: 0, e_deckrep: 0, e_deckrepc: 0,
  e_prep: "0.06", e_rustpct: 0, e_rustm: "0.35",
  e_mildew: 0, e_fast: 0, e_dry: 0,
  a_ht: 0, a_hose: 0, a_method: "1",
  a_liftrate: 0, a_liftdays: 0, a_liftdel: 0,
  a_cranerate: 0, a_cranehrs: 0, a_hoist: 0,
  a_occ: "1.00", a_overspray: 0, a_screens: 0, a_shift: "1.00",
  f_on: "0", f_dens: "3.0", f_thick: 0, f_taper: 0,
  f_yield: 0, f_waste: 0, f_cost: 0, f_freight: 0,
  f_amb: "1.00", f_tex: "0",
  r_lf: 0, r_w: 0, r_type: "0.42", r_c: 0,
  r_rate: 0, r_fieldpct: 0, r_fieldc: 0,
  l_foamrate: 0, l_preprate: 0, l_rustrate: 0, l_tearrate: 0,
  l_crew: 0, l_wage: 0, l_hrs: 0, l_burden: 0,
  l_mobs: 0, l_mobc: 0, l_diem: 0, l_lodge: 0,
  l_wx: 0, l_super: 0,
  q_rig: 0, q_fuel: 0, q_pump: 0, q_wash: 0,
  q_cons: 0, q_hand: 0, q_dump: 0, q_dumpc: 0,
  q_trailer: 0, q_veh: 0,
  s_eng: "0", s_engov: 0, s_pbasis: "pct",
  s_ppct: 0, s_pflat: 0, s_plan: 0,
  s_insp: 0, s_inspc: 0, s_noa: 0, s_ir: 0,
  s_core: 0, s_mock: 0, s_3rd: 0,
  s_war: "0", s_warfee: 0,
  m_tax: 0, m_cont: 0, m_gl: 0, m_bond: 0,
  m_oh: 0, m_comm: 0, m_margin: 0, m_fin: 0,
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
  if (next.products) {
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

