import { TRADES, type Trade } from "@/lib/trades";

interface TradeMixBarProps {
  data: Record<Trade, number>;
}

export function TradeMixBar({ data }: TradeMixBarProps) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  const segments = TRADES.map((t) => ({
    ...t,
    count: data[t.value] ?? 0,
    pct: ((data[t.value] ?? 0) / total) * 100,
  }));

  const visible = segments.filter((s) => s.count > 0);

  return (
    <div>
      {/* Stacked bar */}
      <div
        className="flex h-3 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: "var(--bg-hover)" }}
      >
        {visible.map((s) => (
          <div
            key={s.value}
            style={{ width: `${s.pct}%`, backgroundColor: s.color }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>

      {/* Inline labels (compact) */}
      {visible.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {visible.map((s) => (
            <div
              key={s.value}
              className="flex items-center gap-1.5 text-[11px] font-medium"
              style={{ color: s.color }}
            >
              <span
                className="h-2 w-2 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              {s.label.split(" ")[0]} {s.count}
            </div>
          ))}
        </div>
      )}

      {/* Full legend */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {segments.map((s) => (
          <div key={s.value} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            <span style={{ color: "var(--text-dim)" }}>{s.label}</span>
            <span className="ml-auto font-mono-num font-semibold text-foreground">
              {s.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
