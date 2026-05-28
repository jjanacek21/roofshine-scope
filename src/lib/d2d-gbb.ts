// Pure client-side Good/Better/Best pricing helper for Door-to-Door.
// Runs entirely in the browser — no edge function call.

import { getPitchMultiplier, getWastePct, type PitchBucket, type ComplexityLevel } from "./roofMeasurements";

export type SystemType = "shingle" | "tile" | "metal" | "flat";
export type Tier = "good" | "better" | "best";

export interface TierPricing {
  packageId: string;
  packageName: string;
  pricePerSquare: { low: number; high: number };
  totalLow: number;
  totalHigh: number;
  features: string[];
  warranty: string;
  color: string;
  isPopular?: boolean;
}

export interface GBBResult {
  good: TierPricing;
  better: TierPricing;
  best: TierPricing;
}

export interface MeasurementSummary {
  baseSqFt: number;
  pitchBucket: PitchBucket;
  complexity: ComplexityLevel;
  pitchMultiplier: number;
  wastePct: number;
  trueSqft: number;
  totalWithWaste: number;
  squares: number;
}

// Base $ per square (materials + labor + overhead) for each system & tier.
// Numbers reflect typical 2025 mid-market US retail ranges; can be tuned.
const PRICING: Record<SystemType, Record<Tier, { low: number; high: number; name: string; warranty: string; features: string[] }>> = {
  shingle: {
    good:   { low: 425, high: 525, name: "3-Tab Builder",        warranty: "25-yr limited",  features: ["3-Tab shingles", "Synthetic underlayment", "Standard ridge cap", "Code-min flashing"] },
    better: { low: 575, high: 700, name: "Architectural Pro",    warranty: "Lifetime ltd.",  features: ["Architectural shingles", "Ice & water shield", "Premium ridge cap", "All new flashing"] },
    best:   { low: 825, high: 975, name: "Designer Premium",     warranty: "50-yr non-prorated", features: ["Designer / impact-rated shingles", "Full peel-and-stick deck", "Ridge vent system", "Lifetime workmanship"] },
  },
  tile: {
    good:   { low: 950,  high: 1150, name: "Concrete Tile Standard",  warranty: "30-yr ltd.", features: ["Concrete tile", "30# felt underlayment", "New battens"] },
    better: { low: 1250, high: 1500, name: "Clay Tile Pro",            warranty: "50-yr ltd.", features: ["Clay tile", "Synthetic underlayment", "Mortar / foam set ridges"] },
    best:   { low: 1600, high: 2000, name: "Premium Clay + Solar Ready", warranty: "Lifetime ltd.", features: ["Premium clay tile", "Dual-layer underlayment", "Copper flashings", "Solar-ready hooks"] },
  },
  metal: {
    good:   { low: 950,  high: 1150, name: "Exposed Fastener",    warranty: "30-yr ltd.",   features: ["29 ga exposed fastener panels", "Painted finish", "Code-min flashing"] },
    better: { low: 1250, high: 1500, name: "Standing Seam",        warranty: "Lifetime ltd.", features: ["24 ga standing seam", "Concealed fasteners", "Kynar 500 finish"] },
    best:   { low: 1700, high: 2100, name: "Premium Architectural", warranty: "Lifetime ltd.", features: ["Heavy-gauge standing seam", "Snow guards", "Premium underlayment", "Full perimeter flashing"] },
  },
  flat: {
    good:   { low: 550, high: 700,  name: "Modified Bitumen",    warranty: "10-yr ltd.",   features: ["2-ply mod-bit", "Granular cap sheet", "Basic perimeter detail"] },
    better: { low: 750, high: 950,  name: "TPO 60 mil",            warranty: "20-yr ltd.",   features: ["60 mil TPO membrane", "Mechanically fastened", "Full detail work"] },
    best:   { low: 1050, high: 1300, name: "PVC 80 mil Premium",    warranty: "25-yr NDL",    features: ["80 mil PVC membrane", "Fully adhered", "Heat-welded seams", "Walk pads"] },
  },
};

const SYSTEM_LABELS: Record<SystemType, string> = {
  shingle: "Asphalt Shingle",
  tile: "Tile",
  metal: "Metal",
  flat: "Flat / TPO",
};

export function getSystemLabel(s: SystemType): string {
  return SYSTEM_LABELS[s];
}

/**
 * Compute pitch-adjusted + waste-adjusted measurement from base footprint sq ft.
 */
export function buildMeasurement(baseSqFt: number, pitchBucket: PitchBucket, complexity: ComplexityLevel): MeasurementSummary {
  const pitchMultiplier = getPitchMultiplier(pitchBucket);
  const wastePct = getWastePct("reroof", complexity);
  const trueSqft = Math.round(baseSqFt * pitchMultiplier);
  const totalWithWaste = Math.round(trueSqft * (1 + wastePct));
  const squares = Math.round((totalWithWaste / 100) * 10) / 10;
  return { baseSqFt, pitchBucket, complexity, pitchMultiplier, wastePct, trueSqft, totalWithWaste, squares };
}

export function buildGBB(squares: number, system: SystemType): GBBResult {
  const set = PRICING[system];
  const make = (tier: Tier): TierPricing => {
    const def = set[tier];
    const totalLow = Math.round(def.low * squares);
    const totalHigh = Math.round(def.high * squares);
    return {
      packageId: `${system}-${tier}`,
      packageName: def.name,
      pricePerSquare: { low: def.low, high: def.high },
      totalLow,
      totalHigh,
      features: def.features,
      warranty: def.warranty,
      color: tier === "good" ? "amber" : tier === "better" ? "primary" : "slate",
      isPopular: tier === "better",
    };
  };
  return { good: make("good"), better: make("better"), best: make("best") };
}
