import { createFileRoute } from "@tanstack/react-router";
import { CallPlaybookProvider } from "@/hooks/useCallPlaybook";
import { CallPlaybookPanel } from "@/components/leads/CallPlaybookPanel";
import { CommercialLeadTable } from "@/components/commercial/CommercialLeadTable";

export const Route = createFileRoute("/_app/commercial/leads")({
  component: CommercialLeads,
});

function CommercialLeads() {
  return (
    <CallPlaybookProvider>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Working pipeline — everything past prospecting, with notes, follow-ups and report
            history.
          </p>
        </div>
        <CommercialLeadTable
          statuses={["contacted", "report_sent", "proposal_sent", "won", "lost", "nurture", "dnc"]}
          showStatusFilter
          showPipelineColumns
          moveAction={{ label: "Send back to prospecting", to: "prospect", direction: "back" }}
          emptyText="No active leads yet — convert a prospect to get started."
        />
      </div>
      <CallPlaybookPanel />
    </CallPlaybookProvider>
  );
}
