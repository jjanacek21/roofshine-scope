// Map saved roof measurements -> estimate line-item quantities.
//
// Rules the field team asked for:
//  - Roofing REMOVAL (tear-off) squares = true roof area, NO waste
//  - Roofing REPLACE (install) squares  = true roof area + waste %
//  - Linear-foot items pull the matching measured run (eave, rake, ridge,
//    hip, valley, drip edge, step/wall flashing, gutter, parapet, transition)

export type SavedMeasurement = {
  total_area_sqft?: number | null;
  squares?: number | null;
  waste_pct?: number | null;
  eaves_lf?: number | null;
  rakes_lf?: number | null;
  ridges_lf?: number | null;
  hips_lf?: number | null;
  valleys_lf?: number | null;
  drip_edge_lf?: number | null;
  step_flashing_lf?: number | null;
  wall_flashing_lf?: number | null;
  gutters_lf?: number | null;
  parapet_wall_lf?: number | null;
  transition_lf?: number | null;
};

export type FillTarget = {
  id: string;
  code?: string | null;
  name: string;
  unit: string;
  qty: number;
};

export type FillSuggestion = {
  id: string;
  name: string;
  unit: string;
  currentQty: number;
  newQty: number;
  basis: string;
};

const n = (v: unknown) => (v == null ? 0 : Number(v) || 0);

export function measurementBasics(m: SavedMeasurement) {
  const trueSqft = n(m.total_area_sqft);
  const trueSquares = n(m.squares) || trueSqft / 100;
  const wastePct = n(m.waste_pct);
  const wasteSquares = trueSquares * (1 + wastePct / 100);
  return {
    trueSqft,
    trueSquares,
    wastePct,
    wasteSquares,
    wasteSqft: trueSqft * (1 + wastePct / 100),
  };
}

const REMOVE_WORDS =
  /(remove|removal|tear[- ]?off|tearoff|demo|dispos|haul)/i;
const REPLACE_WORDS =
  /(install|replace|re[- ]?roof|new |lay |apply|felt|underlay|shingle|comp\b|laminate|3[- ]?tab)/i;

type LinearRule = { re: RegExp; key: keyof SavedMeasurement; label: string };

// Order matters: more specific patterns first.
const LINEAR_RULES: LinearRule[] = [
  { re: /(ridge\s*(cap|vent)?|hip\s*(&|and|\/)?\s*ridge|ridge\s*(&|and|\/)?\s*hip)/i, key: "ridges_lf", label: "Ridge LF" },
  { re: /\bhip\b/i, key: "hips_lf", label: "Hip LF" },
  { re: /valley/i, key: "valleys_lf", label: "Valley LF" },
  { re: /drip\s*edge/i, key: "drip_edge_lf", label: "Drip edge LF" },
  { re: /step\s*flash/i, key: "step_flashing_lf", label: "Step flashing LF" },
  { re: /(wall\s*flash|counter\s*flash|apron\s*flash|headwall|sidewall)/i, key: "wall_flashing_lf", label: "Wall flashing LF" },
  { re: /(gutter|downspout\s*run|fascia)/i, key: "gutters_lf", label: "Gutter LF" },
  { re: /parapet/i, key: "parapet_wall_lf", label: "Parapet LF" },
  { re: /transition/i, key: "transition_lf", label: "Transition LF" },
  { re: /\brake\b/i, key: "rakes_lf", label: "Rake LF" },
  { re: /\beave\b/i, key: "eaves_lf", label: "Eave LF" },
  { re: /(perimeter|starter)/i, key: "eaves_lf", label: "Eave LF" },
];

function isLinearUnit(unit: string) {
  return /^(lf|ln ?ft|linear|ft)$/i.test(unit.trim());
}

function isSquareUnit(unit: string) {
  return /^(sq|square|squares)$/i.test(unit.trim());
}

function isSqftUnit(unit: string) {
  return /^(sf|sq ?ft|sqft|square feet)$/i.test(unit.trim());
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

/** Derive a quantity for one line item, or null when nothing matches. */
export function deriveQtyForItem(
  item: { code?: string | null; name: string; unit: string },
  m: SavedMeasurement,
): { qty: number; basis: string } | null {
  const { trueSquares, wasteSquares, trueSqft, wasteSqft, wastePct } = measurementBasics(m);
  const text = `${item.code ?? ""} ${item.name}`;
  const unit = item.unit ?? "";

  // Roof area items
  if (isSquareUnit(unit) || isSqftUnit(unit)) {
    const removal = REMOVE_WORDS.test(text);
    const replace = !removal && REPLACE_WORDS.test(text);
    if (!removal && !replace) return null;
    if (isSquareUnit(unit)) {
      return removal
        ? { qty: round2(trueSquares), basis: "True squares (no waste)" }
        : { qty: round2(wasteSquares), basis: `Squares + ${wastePct}% waste` };
    }
    return removal
      ? { qty: round2(trueSqft), basis: "True sqft (no waste)" }
      : { qty: round2(wasteSqft), basis: `Sqft + ${wastePct}% waste` };
  }

  // Linear items
  if (isLinearUnit(unit)) {
    for (const rule of LINEAR_RULES) {
      if (rule.re.test(text)) {
        const value = n(m[rule.key]);
        if (value <= 0) return null;
        return { qty: round2(value), basis: rule.label };
      }
    }
  }

  return null;
}

/** Build the list of quantity changes for the whole estimate. */
export function buildFillSuggestions(
  items: FillTarget[],
  m: SavedMeasurement,
): FillSuggestion[] {
  const out: FillSuggestion[] = [];
  for (const item of items) {
    const derived = deriveQtyForItem(item, m);
    if (!derived || derived.qty <= 0) continue;
    if (round2(Number(item.qty ?? 0)) === derived.qty) continue;
    out.push({
      id: item.id,
      name: item.name,
      unit: item.unit,
      currentQty: Number(item.qty ?? 0),
      newQty: derived.qty,
      basis: derived.basis,
    });
  }
  return out;
}
