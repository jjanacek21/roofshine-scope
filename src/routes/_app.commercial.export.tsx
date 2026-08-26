import { createFileRoute } from "@tanstack/react-router";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { useIsRoofKing } from "@/hooks/useRoofKing";
import { useRKAccounts, useRKProperties, useRKTickets } from "@/hooks/roofking/useRKData";
import { contactsCsv, propertiesCsv, ticketsCsv, fullJsonBackup, download } from "@/lib/roofking/csv";

export const Route = createFileRoute("/_app/roofking/export")({
  component: ExportPage,
});

function ExportPage() {
  const { companyId } = useIsRoofKing();
  const { data: accounts = [] } = useRKAccounts(companyId);
  const { data: properties = [] } = useRKProperties(companyId);
  const { data: tickets = [] } = useRKTickets(companyId);

  function downloadContacts() {
    download("contacts.csv", contactsCsv(accounts, properties, tickets));
  }
  function downloadProperties() {
    download("properties.csv", propertiesCsv(accounts, properties, tickets));
  }
  function downloadTickets() {
    download("service_tickets.csv", ticketsCsv(accounts, properties, tickets));
  }
  function downloadAll() {
    downloadContacts();
    setTimeout(downloadProperties, 250);
    setTimeout(downloadTickets, 500);
  }
  function downloadJson() {
    download("roof-king-backup.json", fullJsonBackup(accounts, properties, tickets), "application/json");
  }

  return (
    <div className="space-y-5">
      <div className="rk-card rk-fade-in p-5">
        <h3 className="rk-display text-base">Export to CRM</h3>
        <p className="mt-1 text-sm" style={{ color: "var(--rk-ink-muted)" }}>
          Three ID-linked CSVs (UTF-8 with BOM) so account → building → ticket relationships survive a re-import. Use the prefixed IDs (<span className="rk-num">ACCT-</span>, <span className="rk-num">PROP-</span>, <span className="rk-num">TKT-</span>) as link keys.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ExportCard
          title="contacts.csv"
          subtitle={`${accounts.length} customers`}
          onClick={downloadContacts}
        />
        <ExportCard
          title="properties.csv"
          subtitle={`${properties.length} buildings`}
          onClick={downloadProperties}
        />
        <ExportCard
          title="service_tickets.csv"
          subtitle={`${tickets.length} tickets`}
          onClick={downloadTickets}
        />
      </div>

      <div className="rk-card rk-fade-in delay-3 flex flex-wrap items-center gap-3 p-5">
        <button onClick={downloadAll} className="rk-btn rk-btn-primary">
          <Download className="h-3.5 w-3.5" /> Download all 3
        </button>
        <button onClick={downloadJson} className="rk-btn rk-btn-ghost">
          <FileJson className="h-3.5 w-3.5" /> Full JSON backup
        </button>
      </div>
    </div>
  );
}

function ExportCard({ title, subtitle, onClick }: { title: string; subtitle: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rk-card rk-card-hover rk-fade-in p-5 text-left">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "rgba(47,129,247,0.18)", color: "var(--rk-accent-light)" }}>
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <div>
          <p className="rk-display text-sm">{title}</p>
          <p className="text-xs" style={{ color: "var(--rk-ink-muted)" }}>{subtitle}</p>
        </div>
      </div>
      <div className="mt-4 inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--rk-accent-light)" }}>
        <Download className="h-3.5 w-3.5" /> Download
      </div>
    </button>
  );
}
