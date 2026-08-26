import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  hint,
  icon,
  accent = "var(--rk-accent)",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="rk-card rk-card-hover rk-fade-in p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="rk-label">{label}</p>
          <p className="rk-display rk-num mt-2 text-3xl" style={{ color: "var(--rk-ink)" }}>
            {value}
          </p>
          {hint ? <p className="mt-1 text-xs" style={{ color: "var(--rk-ink-muted)" }}>{hint}</p> : null}
        </div>
        {icon ? (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: accent + "1f", color: accent }}
          >
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
