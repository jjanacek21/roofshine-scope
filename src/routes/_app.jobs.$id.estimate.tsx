import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";

export const Route = createFileRoute("/_app/jobs/$id/estimate")({
  component: JobEstimate,
});

function JobEstimate() {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-xl border p-12 text-center"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
    >
      <Receipt className="h-8 w-8 text-muted-foreground opacity-50" />
      <h3 className="text-base font-semibold text-foreground">Estimate workspace coming next</h3>
      <p className="max-w-md text-sm text-muted-foreground">
        Tier tabs (Good/Better/Best), line items grouped by trade, companion-rule banners, and a
        sticky totals panel ship in the next stage of this build.
      </p>
    </div>
  );
}
