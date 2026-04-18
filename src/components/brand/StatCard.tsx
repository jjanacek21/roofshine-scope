import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  unit?: string;
  icon?: ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  delta,
  deltaDirection = "up",
  unit,
  className,
}: StatCardProps) {
  const deltaColor =
    deltaDirection === "down"
      ? "var(--danger)"
      : deltaDirection === "neutral"
        ? "var(--text-muted)"
        : "var(--success)";

  return (
    <div
      className={cn("stat-glow rounded-[14px] p-5", className)}
    >
      <p
        className="text-[11px] font-semibold uppercase"
        style={{ color: "var(--text-muted)", letterSpacing: "1.2px" }}
      >
        {label}
      </p>
      <p
        className="mt-2 font-extrabold leading-none text-foreground"
        style={{ fontSize: 30, letterSpacing: "-1.2px" }}
      >
        {value}
        {unit && (
          <span
            className="ml-1 font-semibold"
            style={{ color: "var(--text-muted)", fontSize: 16 }}
          >
            {unit}
          </span>
        )}
      </p>
      {delta && (
        <p
          className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold"
          style={{ color: deltaColor }}
        >
          {deltaDirection === "down" ? (
            <ArrowDown className="h-3 w-3" />
          ) : deltaDirection === "up" ? (
            <ArrowUp className="h-3 w-3" />
          ) : null}
          {delta}
        </p>
      )}
    </div>
  );
}
