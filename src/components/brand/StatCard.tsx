import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  icon?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, delta, icon, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "stat-glow relative overflow-hidden rounded-xl p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {icon && <div className="text-muted-foreground/60">{icon}</div>}
      </div>
      <p className="mt-3 font-mono-num text-3xl font-bold tracking-tight text-foreground">
        {value}
      </p>
      {delta && (
        <p className="mt-1 text-xs text-muted-foreground">{delta}</p>
      )}
    </div>
  );
}
