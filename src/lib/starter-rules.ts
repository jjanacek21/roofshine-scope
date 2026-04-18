// Seed companion rules — placeholder suggested_codes (category names).
// Users edit to real Xactimate codes after upload.
import type { Trade } from "@/lib/trades";

export type StarterRule = {
  trigger_category: string;
  trigger_trade: Trade;
  suggested_codes: string[];
  rule_type: "required" | "recommended" | "conditional";
  notes?: string;
};

export const STARTER_RULES: StarterRule[] = [
  // Roofing
  { trigger_category: "shingles", trigger_trade: "roofing", rule_type: "required",
    suggested_codes: ["drip edge", "starter strip", "underlayment", "ridge cap", "pipe boot", "valley metal", "permit", "dump fee"] },
  { trigger_category: "tile_roofing", trigger_trade: "roofing", rule_type: "required",
    suggested_codes: ["SA underlayment", "drip edge", "eave closure", "tile starter", "ridge board", "pipe boot", "valley", "permit", "dump fee", "engineer letter"] },
  { trigger_category: "coating_silicone", trigger_trade: "roofing", rule_type: "recommended",
    suggested_codes: ["pressure wash", "primer", "reinforcing fabric", "base coat", "top coat", "walkway pads", "mobilization"] },
  { trigger_category: "spray_foam", trigger_trade: "roofing", rule_type: "recommended",
    suggested_codes: ["pressure wash", "primer", "SPF base", "granules", "top coat", "mobilization", "permit"] },
  { trigger_category: "tear_off", trigger_trade: "roofing", rule_type: "required",
    suggested_codes: ["dump fee", "detach/reset solar", "detach/reset antenna", "permit"] },

  // Exterior
  { trigger_category: "siding", trigger_trade: "exterior", rule_type: "required",
    suggested_codes: ["removal", "house wrap", "install", "trim", "caulk", "paint", "dump fee"] },
  { trigger_category: "stucco", trigger_trade: "exterior", rule_type: "required",
    suggested_codes: ["removal", "lath", "base coat", "finish coat", "paint", "caulk"] },
  { trigger_category: "gutters", trigger_trade: "exterior", rule_type: "required",
    suggested_codes: ["install", "downspouts", "end caps", "hangers", "seal"] },
  { trigger_category: "soffit_fascia", trigger_trade: "exterior", rule_type: "required",
    suggested_codes: ["removal", "install", "fascia", "paint", "vents"] },
  { trigger_category: "exterior_paint", trigger_trade: "exterior", rule_type: "recommended",
    suggested_codes: ["pressure wash", "primer", "caulk", "body paint", "trim paint"] },

  // Windows / Doors
  { trigger_category: "windows", trigger_trade: "windows", rule_type: "required",
    suggested_codes: ["remove", "install", "seal", "trim", "stucco patch", "paint", "permit"] },
  { trigger_category: "exterior_doors", trigger_trade: "windows", rule_type: "required",
    suggested_codes: ["remove", "install", "frame", "hardware", "paint", "weatherstripping"] },
  { trigger_category: "interior_doors", trigger_trade: "windows", rule_type: "recommended",
    suggested_codes: ["install", "frame", "hardware", "trim", "paint"] },

  // Interior
  { trigger_category: "drywall", trigger_trade: "interior", rule_type: "required",
    suggested_codes: ["remove", "hang", "tape", "finish", "texture", "prime", "paint", "dump fee"] },
  { trigger_category: "interior_paint", trigger_trade: "interior", rule_type: "required",
    suggested_codes: ["prep", "prime", "caulk", "walls", "ceiling", "trim"] },
  { trigger_category: "flooring_tile", trigger_trade: "interior", rule_type: "required",
    suggested_codes: ["remove", "prep", "thinset", "tile", "grout", "seal", "transitions"] },
  { trigger_category: "flooring_carpet", trigger_trade: "interior", rule_type: "required",
    suggested_codes: ["remove", "pad", "carpet", "binding", "dump fee"] },
  { trigger_category: "flooring_hardwood", trigger_trade: "interior", rule_type: "required",
    suggested_codes: ["remove", "underlayment", "hardwood", "transitions", "quarter round", "finish"] },
  { trigger_category: "flooring_lvp", trigger_trade: "interior", rule_type: "required",
    suggested_codes: ["remove", "prep", "underlayment", "LVP", "transitions", "quarter round"] },
  { trigger_category: "cabinets", trigger_trade: "interior", rule_type: "required",
    suggested_codes: ["remove", "install", "hardware", "countertop", "backsplash", "dump fee"] },
  { trigger_category: "trim", trigger_trade: "interior", rule_type: "recommended",
    suggested_codes: ["base", "casing", "crown", "caulk", "paint"] },
  { trigger_category: "insulation", trigger_trade: "interior", rule_type: "recommended",
    suggested_codes: ["batt", "blown", "radiant", "vapor barrier"] },

  // HVAC
  { trigger_category: "hvac_condenser", trigger_trade: "hvac", rule_type: "required",
    suggested_codes: ["condenser", "pad", "disconnect", "line set", "permit", "startup"] },
  { trigger_category: "hvac_handler", trigger_trade: "hvac", rule_type: "required",
    suggested_codes: ["handler", "coil", "duct", "drain", "thermostat"] },
  { trigger_category: "hvac_ductwork", trigger_trade: "hvac", rule_type: "recommended",
    suggested_codes: ["duct", "insulation", "tape", "registers", "balancing"] },

  // Plumbing
  { trigger_category: "plumbing_water_heater", trigger_trade: "plumbing", rule_type: "required",
    suggested_codes: ["tank", "flex", "drain pan", "pan", "permit", "disconnect"] },
  { trigger_category: "plumbing_fixtures", trigger_trade: "plumbing", rule_type: "required",
    suggested_codes: ["fixture", "supply", "drain", "valve", "seal"] },
  { trigger_category: "plumbing_toilet", trigger_trade: "plumbing", rule_type: "required",
    suggested_codes: ["toilet", "wax ring", "supply", "valve", "seal"] },

  // Electrical
  { trigger_category: "electrical_panel", trigger_trade: "electrical", rule_type: "required",
    suggested_codes: ["panel", "breakers", "grounding", "permit", "label"] },
  { trigger_category: "electrical_outlets", trigger_trade: "electrical", rule_type: "recommended",
    suggested_codes: ["outlet", "cover", "wire"] },
  { trigger_category: "electrical_fixtures", trigger_trade: "electrical", rule_type: "recommended",
    suggested_codes: ["fixture", "bulb", "switch", "dimmer"] },

  // Mitigation
  { trigger_category: "water_damage", trigger_trade: "mitigation", rule_type: "required",
    suggested_codes: ["extraction", "dehumidification", "air movers", "antimicrobial", "moisture monitoring", "containment"] },
  { trigger_category: "mold_remediation", trigger_trade: "mitigation", rule_type: "required",
    suggested_codes: ["containment", "PPE", "HEPA", "antimicrobial", "encapsulation", "air scrubbing"] },
  { trigger_category: "demolition", trigger_trade: "mitigation", rule_type: "recommended",
    suggested_codes: ["drywall", "insulation", "flooring", "dump fee", "cleaning"] },
  { trigger_category: "cleaning", trigger_trade: "mitigation", rule_type: "recommended",
    suggested_codes: ["final clean", "duct cleaning", "carpet", "hard surfaces"] },
];
