/**
 * Claim Buddy plan tiers and the features each one unlocks.
 *
 * The database is the source of truth (cb_workspaces.tier / features / is_comp,
 * resolved by public.cb_resolved_features). These helpers mirror that logic so the
 * UI can lock a control instantly without another round trip.
 */

export type CbTier = "basic" | "pro" | "elite";

export type CbFeature = "ai_measure" | "survival_guide" | "price_book" | "storm_intel";

export const CB_TIERS: CbTier[] = ["basic", "pro", "elite"];

export const CB_TIER_LABEL: Record<CbTier, string> = {
  basic: "Basic",
  pro: "Pro",
  elite: "Elite",
};

export const CB_FEATURE_LABEL: Record<CbFeature, string> = {
  ai_measure: "AI measurements",
  survival_guide: "Survival Guide",
  price_book: "Xactimate price book",
  storm_intel: "Storm Intel map",
};

export const CB_FEATURES = Object.keys(CB_FEATURE_LABEL) as CbFeature[];

export type CbFeatureMap = Record<CbFeature, boolean>;

const NONE: CbFeatureMap = {
  ai_measure: false,
  survival_guide: false,
  price_book: false,
  storm_intel: false,
};

export function cbTierDefaults(tier: CbTier | string | null | undefined): CbFeatureMap {
  switch ((tier ?? "basic").toLowerCase()) {
    case "elite":
      return { ai_measure: true, survival_guide: true, price_book: true, storm_intel: true };
    case "pro":
      return { ...NONE, ai_measure: true, survival_guide: true };
    default:
      return { ...NONE };
  }
}

/** Tier defaults, then per-company overrides. A comp account gets everything. */
export function cbResolveFeatures(input: {
  tier?: string | null;
  is_comp?: boolean | null;
  features?: Partial<Record<string, boolean>> | null;
}): CbFeatureMap {
  if (input.is_comp) return cbTierDefaults("elite");
  const base = cbTierDefaults(input.tier);
  const overrides = input.features ?? {};
  for (const f of CB_FEATURES) {
    if (typeof overrides[f] === "boolean") base[f] = overrides[f] as boolean;
  }
  return base;
}

/** The cheapest tier that includes a feature — used in upgrade copy. */
export function cbTierFor(feature: CbFeature): CbTier {
  for (const t of CB_TIERS) if (cbTierDefaults(t)[feature]) return t;
  return "elite";
}

export function cbUpgradeCopy(feature: CbFeature): string {
  return `${CB_FEATURE_LABEL[feature]} is part of the ${CB_TIER_LABEL[cbTierFor(feature)]} plan. Ask your admin to upgrade to switch it on.`;
}
