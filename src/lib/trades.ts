export const TRADES = [
  { value: "roofing", label: "Roofing", color: "#eab308", icon: "home" },
  { value: "exterior", label: "Exterior", color: "#d4a574", icon: "building" },
  { value: "windows", label: "Windows & Doors", color: "#06b6d4", icon: "rectangle-vertical" },
  { value: "interior", label: "Interior", color: "#a855f7", icon: "layout-dashboard" },
  { value: "hvac", label: "HVAC", color: "#22c55e", icon: "fan" },
  { value: "plumbing", label: "Plumbing", color: "#3b82f6", icon: "droplets" },
  { value: "electrical", label: "Electrical", color: "#f59e0b", icon: "zap" },
  { value: "mitigation", label: "Water/Mold Mitigation", color: "#ef4444", icon: "shield-alert" },
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
