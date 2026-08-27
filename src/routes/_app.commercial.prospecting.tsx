import { createFileRoute } from "@tanstack/react-router";
import { CallPlaybookProvider } from "@/hooks/useCallPlaybook";
import { CallPlaybookPanel } from "@/components/leads/CallPlaybookPanel";
import { CommercialLeadTable } from "@/components/commercial/CommercialLeadTable";

export const Route = createFileRoute("/_app/commercial/prospecting")({
  component: CommercialProspecting,
});

function CommercialProspecting() {
  return (
    <CallPlaybookProvider>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Prospecting</h1>
          <p className="text-sm text-muted-foreground">
            Untouched properties. Import addresses, run outreach and send a savings report.
          </p>
        </div>
        <CommercialLeadTable
          statuses={["prospect"]}
          moveAction={{ label: "Convert to lead", to: "contacted", direction: "forward" }}
          emptyText="No prospects yet — import addresses to get started."
        />
      </div>
      <CallPlaybookPanel />
    </CallPlaybookProvider>
  );
}
