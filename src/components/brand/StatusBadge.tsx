import { cn } from "@/lib/utils";

// Prototype-matched palette: bg / border / text
const STATUS_STYLES: Record<
  string,
  { bg: string; border: string; text: string; label?: string }
> = {
  lead: {
    bg: "rgba(161,161,170,.15)",
    border: "rgba(161,161,170,.2)",
    text: "#d4d4d8",
  },
  inspected: {
    bg: "rgba(212,165,116,.15)",
    border: "rgba(212,165,116,.3)",
    text: "#d4a574",
  },
  estimated: {
    bg: "rgba(30,144,255,.15)",
    border: "rgba(30,144,255,.3)",
    text: "#7dc3ff",
  },
  proposed: {
    bg: "rgba(168,85,247,.15)",
    border: "rgba(168,85,247,.3)",
    text: "#c4a5f7",
  },
  signed: {
    bg: "rgba(34,197,94,.15)",
    border: "rgba(34,197,94,.3)",
    text: "#86efac",
  },
  in_progress: {
    bg: "rgba(234,179,8,.15)",
    border: "rgba(234,179,8,.3)",
    text: "#fde047",
    label: "In Progress",
  },
  complete: {
    bg: "rgba(71,85,105,.3)",
    border: "rgba(71,85,105,.4)",
    text: "#cbd5e1",
  },
  draft: {
    bg: "rgba(161,161,170,.15)",
    border: "rgba(161,161,170,.2)",
    text: "#d4d4d8",
  },
  sent: {
    bg: "rgba(30,144,255,.15)",
    border: "rgba(30,144,255,.3)",
    text: "#7dc3ff",
  },
  approved: {
    bg: "rgba(34,197,94,.15)",
    border: "rgba(34,197,94,.3)",
    text: "#86efac",
  },
  rejected: {
    bg: "rgba(239,68,68,.15)",
    border: "rgba(239,68,68,.3)",
    text: "#fca5a5",
  },
  active: {
    bg: "rgba(34,197,94,.15)",
    border: "rgba(34,197,94,.3)",
    text: "#86efac",
  },
  inactive: {
    bg: "rgba(161,161,170,.15)",
    border: "rgba(161,161,170,.2)",
    text: "#d4d4d8",
  },
  archived: {
    bg: "rgba(71,85,105,.3)",
    border: "rgba(71,85,105,.4)",
    text: "#cbd5e1",
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
