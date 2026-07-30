// Single source of truth for storm-canvassing magic numbers.
// Do not scatter these values through the codebase.

/** Plan (footprint) area is multiplied by this to account for roof pitch. */
export const PITCH_FACTOR = 1.08;
/** Pitched area is multiplied by this to account for material waste. */
export const WASTE_FACTOR = 1.12;

/** House circles only render at or above this zoom level. */
export const HOUSE_CIRCLE_MIN_ZOOM = 17;

/** Storm report windows (days). */
export const HAIL_WINDOW_DAYS = 60;
export const WIND_WINDOW_DAYS = 730;
/** Radius for point storm lookups (metres, ~0.5 mi). */
export const POINT_RADIUS_M = 805;

/** Minimum wind speed shown on the wind layer. */
export const WIND_MIN_MPH = 60;

/** Earliest date hail swath data exists for. Anything older has no coverage. */
export const HAIL_DATA_START = "2026-05-16";

export const MAILER_TONES = [
  "Urgent",
  "Neighborly",
  "Professional",
  "Empathetic",
  "Bold & Direct",
  "Educational",
  "Premium / High-End",
] as const;
export type MailerTone = (typeof MAILER_TONES)[number];

export const STORM_TYPES = ["hail", "wind", "hurricane", "tornado"] as const;
export type StormType = (typeof STORM_TYPES)[number];

export const MAILER_IMAGE_BUCKET = "storm-mailer-images";

export type RoofMath = {
  planSqft: number;
  pitchedSqft: number;
  finalSqft: number;
  squares: number;
};

/**
 * Compound pitch then waste, always starting from PLAN (footprint) area.
 * Never pass an already pitch-adjusted (actual) area in here.
 */
export function roofMathFromPlan(planSqft: number): RoofMath {
  const pitchedSqft = planSqft * PITCH_FACTOR;
  const finalSqft = pitchedSqft * WASTE_FACTOR;
  return {
    planSqft,
    pitchedSqft,
    finalSqft,
    squares: finalSqft / 100,
  };
}

/** Colours for saved door dispositions (reused for house circles). */
export const DISPOSITION_COLORS: Record<string, string> = {
  not_home: "#94a3b8",
  not_interested: "#ef4444",
  go_back: "#f59e0b",
  interested: "#22c55e",
  needs_inspection: "#06b6d4",
  need_inspection: "#06b6d4",
  appointment_set: "#3b82f6",
  contract_signed: "#8b5cf6",
  storm_damage: "#f97316",
  canvass_lead: "#eab308",
  follow_up: "#f59e0b",
  inspected: "#14b8a6",
  won: "#16a34a",
  not_contacted: "#64748b",
};

export const DISPOSITION_OPTIONS: { value: string; label: string }[] = [
  { value: "not_home", label: "Not home" },
  { value: "not_interested", label: "Not interested" },
  { value: "go_back", label: "Go back" },
  { value: "interested", label: "Interested" },
  { value: "needs_inspection", label: "Needs inspection" },
  { value: "appointment_set", label: "Appointment set" },
  { value: "storm_damage", label: "Storm damage" },
  { value: "contract_signed", label: "Contract signed" },
];

export function dispositionColor(d?: string | null) {
  return (d && DISPOSITION_COLORS[d]) || "#38bdf8";
}
