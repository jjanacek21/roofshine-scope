import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_app/jobs/$id/report")({
  component: JobReport,
});

function JobReport() {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-xl border p-12 text-center"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
    >
      <FileText className="h-8 w-8 text-muted-foreground opacity-50" />
      <h3 className="text-base font-semibold text-foreground">PDF proposal coming next</h3>
      <p className="max-w-md text-sm text-muted-foreground">
        Live preview with cover, executive summary, damage table, measurements, line items,
        photos, and signature block — plus one-click PDF generation — ships in the final stage.
      </p>
    </div>
  );
}
