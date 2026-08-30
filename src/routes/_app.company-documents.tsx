import { createFileRoute } from "@tanstack/react-router";
import { CompanyDocumentsPanel } from "@/components/company/CompanyDocumentsPanel";

export const Route = createFileRoute("/_app/company-documents")({
  component: CompanyDocumentsRoute,
});

function CompanyDocumentsRoute() {
  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <CompanyDocumentsPanel />
    </div>
  );
}
