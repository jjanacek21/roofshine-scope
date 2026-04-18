import { getTradeColor, getTradeLabel } from "@/lib/trades";
import { cn } from "@/lib/utils";

interface TradeBadgeProps {
  trade: string;
  className?: string;
  size?: "sm" | "md";
}

export function TradeBadge({ trade, className, size = "sm" }: TradeBadgeProps) {
  const color = getTradeColor(trade);
  const label = getTradeLabel(trade);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded font-semibold uppercase",
        className,
      )}
      style={{
        backgroundColor: `${color}26`,
        border: `1px solid ${color}4d`,
        color: color,
        padding: size === "md" ? "4px 10px" : "3px 8px",
        fontSize: 11,
        letterSpacing: ".3px",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
