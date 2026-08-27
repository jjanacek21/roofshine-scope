import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Briefcase, Send } from "lucide-react";
import { CallPlaybookProvider } from "@/hooks/useCallPlaybook";
import { CallPlaybookPanel } from "@/components/leads/CallPlaybookPanel";
import { CommercialLeadTable } from "@/components/commercial/CommercialLeadTable";
import { ReportHistoryTable } from "@/components/commercial/ReportHistoryTable";

export const Route = createFileRoute("/_app/commercial/leads")({
  component: CommercialLeads,
});

const TABS = [
  { key: "pipeline", label: "Pipeline", icon: Briefcase },
  { key: "reports", label: "Reports sent", icon: Send },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function CommercialLeads() {
  const [tab, setTab] = useState<TabKey>("pipeline");

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

        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={
                  "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors " +
                  (active
                    ? "border-transparent bg-[var(--brand)] text-white"
                    : "border-[var(--border)] text-muted-foreground hover:bg-[var(--bg-hover)]")
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "pipeline" ? (
          <CommercialLeadTable
            statuses={[
              "contacted",
              "report_sent",
              "proposal_sent",
              "won",
              "lost",
              "nurture",
              "dnc",
            ]}
            showStatusFilter
            showPipelineColumns
            moveAction={{ label: "Send back to prospecting", to: "prospect", direction: "back" }}
            emptyText="No active leads yet — convert a prospect to get started."
          />
        ) : (
          <ReportHistoryTable />
        )}
      </div>
      <CallPlaybookPanel />
    </CallPlaybookProvider>
  );
}
