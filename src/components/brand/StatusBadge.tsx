import { cn } from "@/lib/utils";

// Light-theme palette: soft tinted bg / solid border / dark readable text
const GREEN = {
  bg: "rgba(21,128,61,.12)",
  border: "rgba(21,128,61,.45)",
  text: "#14532d",
};

const STATUS_STYLES: Record<
  string,
  { bg: string; border: string; text: string; label?: string }
> = {
  lead: { ...GREEN },
  inspected: {
    bg: "rgba(180,83,9,.12)",
    border: "rgba(180,83,9,.45)",
    text: "#7c2d12",
  },
  estimated: {
    bg: "rgba(3,105,161,.12)",
    border: "rgba(3,105,161,.45)",
    text: "#0c4a6e",
  },
  proposed: {
    bg: "rgba(126,34,206,.12)",
    border: "rgba(126,34,206,.45)",
    text: "#581c87",
  },
  signed: { ...GREEN },
  in_progress: {
    bg: "rgba(180,83,9,.14)",
    border: "rgba(180,83,9,.45)",
    text: "#78350f",
    label: "In Progress",
  },
  complete: { ...GREEN },
  draft: { ...GREEN },
  sent: {
    bg: "rgba(3,105,161,.12)",
    border: "rgba(3,105,161,.45)",
    text: "#0c4a6e",
  },
  approved: { ...GREEN },
  rejected: {
    bg: "rgba(220,38,38,.12)",
    border: "rgba(220,38,38,.45)",
    text: "#7f1d1d",
  },
  active: { ...GREEN },
  inactive: {
    bg: "rgba(71,85,105,.12)",
    border: "rgba(71,85,105,.45)",
    text: "#1e293b",
  },
  archived: {
    bg: "rgba(71,85,105,.12)",
    border: "rgba(71,85,105,.45)",
    text: "#1e293b",
  },
};


interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style =
    STATUS_STYLES[status] ?? {
      bg: "rgba(161,161,170,.15)",
      border: "rgba(161,161,170,.2)",
      text: "#d4d4d8",
    };
  const label =
    style.label ?? status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded font-semibold uppercase",
        className,
      )}
      style={{
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        color: style.text,
        padding: "3px 8px",
        fontSize: 11,
        letterSpacing: ".3px",
      }}
    >
      {label}
    </span>
  );
}
