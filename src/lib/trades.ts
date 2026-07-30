export const TRADES = [
  { value: "roofing", label: "Roofing", color: "#eab308", icon: "home" },
  { value: "elevations", label: "Elevations", color: "#f97316", icon: "layers" },
  { value: "exterior", label: "Exterior", color: "#d4a574", icon: "building" },
  { value: "concrete_asphalt", label: "Concrete / Asphalt", color: "#94a3b8", icon: "square" },
  { value: "painting", label: "Painting", color: "#ec4899", icon: "paintbrush" },
  { value: "interior", label: "Interior", color: "#a855f7", icon: "layout-dashboard" },
  { value: "windows", label: "Windows & Doors", color: "#06b6d4", icon: "rectangle-vertical" },
  { value: "plumbing", label: "Plumbing", color: "#3b82f6", icon: "droplets" },
  { value: "electrical", label: "Electrical", color: "#f59e0b", icon: "zap" },
  { value: "hvac", label: "HVAC", color: "#22c55e", icon: "fan" },
  { value: "mitigation", label: "Water/Mold Mitigation", color: "#ef4444", icon: "shield-alert" },
  { value: "equipment", label: "Equipment", color: "#0ea5e9", icon: "forklift" },
  { value: "labor", label: "Labor", color: "#14b8a6", icon: "hard-hat" },
  { value: "demo", label: "Demo", color: "#78716c", icon: "hammer" },
  { value: "misc", label: "Misc Items", color: "#8b5cf6", icon: "package" },
  { value: "landscaping", label: "Tree Removal / Landscaping", color: "#65a30d", icon: "trees" },
] as const;


export type Trade = (typeof TRADES)[number]["value"];

export function getTradeColor(trade: string): string {
  return TRADES.find((t) => t.value === trade)?.color ?? "#71717a";
}

export function getTradeLabel(trade: string): string {
  return TRADES.find((t) => t.value === trade)?.label ?? "Other";
}

export const JOB_STATUSES = [
  { value: "lead", label: "Lead" },
  { value: "inspected", label: "Inspected" },
  { value: "estimated", label: "Estimated" },
  { value: "proposed", label: "Proposed" },
  { value: "signed", label: "Signed" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Complete" },
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number]["value"];
