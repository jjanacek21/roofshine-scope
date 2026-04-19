// Photo tag taxonomy
export const PHOTO_TAGS = [
  "roof_overview",
  "front_elevation",
  "rear_elevation",
  "left_elevation",
  "right_elevation",
  "ridge_close",
  "valley_close",
  "flashing",
  "gutter",
  "interior_damage",
  "ceiling_stain",
  "hvac",
  "plumbing",
  "electrical",
  "before",
  "after",
  "other",
] as const;
export type PhotoTag = (typeof PHOTO_TAGS)[number];

export const PHOTO_TAG_LABELS: Record<PhotoTag, string> = {
  roof_overview: "Roof Overview",
  front_elevation: "Front Elevation",
  rear_elevation: "Rear Elevation",
  left_elevation: "Left Elevation",
  right_elevation: "Right Elevation",
  ridge_close: "Ridge Close-up",
  valley_close: "Valley Close-up",
  flashing: "Flashing",
  gutter: "Gutter",
  interior_damage: "Interior Damage",
  ceiling_stain: "Ceiling Stain",
  hvac: "HVAC",
  plumbing: "Plumbing",
  electrical: "Electrical",
  before: "Before",
  after: "After",
  other: "Other",
};

export function conditionColor(score: number | null | undefined): string {
  if (score == null) return "var(--muted-foreground)";
  if (score < 50) return "#ef4444";
  if (score < 80) return "#eab308";
  return "#22c55e";
}
