import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  lead: "#71717a",
  inspected: "#06b6d4",
  estimated: "#a855f7",
  proposed: "#f59e0b",
  signed: "#22c55e",
  in_progress: "#1e90ff",
  complete: "#22c55e",
  draft: "#71717a",
  sent: "#06b6d4",
  approved: "#22c55e",
  rejected: "#ef4444",
  active: "#22c55e",
  inactive: "#71717a",
  archived: "#71717a",
};

const STATUS_LABELS: Record<string, string> = {
  in_progress: "In Progress",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const color = STATUS_COLORS[status] ?? "#71717a";
  const label =
    STATUS_LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
        className,
      )}
      style={{
        backgroundColor: `${color}1f`,
        borderColor: `${color}40`,
        color: color,
      }}
    >
      {label}
    </span>
  );
}
