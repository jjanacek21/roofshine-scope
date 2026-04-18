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
        "inline-flex items-center gap-1.5 rounded-md border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className,
      )}
      style={{
        backgroundColor: `${color}1f`, // ~12% alpha
        borderColor: `${color}40`,
        color: color,
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
