import { createFileRoute } from "@tanstack/react-router";
import { SpfCatalogEditor } from "@/components/spf/SpfCatalogEditor";

export const Route = createFileRoute("/admin/spf")({
  component: AdminSpfPage,
});

function AdminSpfPage() {
  return (
    <SpfCatalogEditor
      title="SPF Calculator"
      description="Coating products, detail line items, preset stacks and per-field defaults for the platform's own company. Each customer company keeps its own catalog and edits it from Commercial Roofing → Calculator setup."
    />
  );
}
