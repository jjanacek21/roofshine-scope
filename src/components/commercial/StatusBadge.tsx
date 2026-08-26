import type { RKStatus } from "@/lib/commercial/types";
import { RK_STATUS_COLORS, RK_STATUS_LABELS } from "@/lib/commercial/types";

export function RKStatusBadge({ status }: { status: RKStatus }) {
  const c = RK_STATUS_COLORS[status];
  return (
    <span
      className="rk-status-pill"
      style={{
        color: c,
        background: c + "29", // ~16% opacity
      }}
    >
      {RK_STATUS_LABELS[status]}
    </span>
  );
}
