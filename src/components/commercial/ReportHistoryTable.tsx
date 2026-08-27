import { useMemo, useState } from "react";
import { Download, FileText, Mail, MessageSquare, Hand } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useCompanyReports, type ReportWithLead } from "@/hooks/useLeadReports";
import { METHOD_LABELS, openStoredReport, type DeliveryMethod } from "@/lib/leads/report-delivery";
import { buildReportCsv, downloadCsv, exportFilename } from "@/lib/commercial/lead-export";

const METHOD_ICON: Record<DeliveryMethod, typeof Mail> = {
  email: Mail,
  text: MessageSquare,
  hand: Hand,
  download: Download,
};

const KIND_LABELS: Record<string, string> = {
  savings: "Savings report",
  ai_roof: "AI roof report",
  proposal: "Proposal",
};

function when(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

/**
 * Every report this company has sent, newest first.
 *
 * This is the answer to "who has seen our numbers and when" — the question a
 * rep asks before picking up the phone, and the one an owner asks before
 * paying for another round of prospecting.
 */
export function ReportHistoryTable() {
  const { data: reports = [], isLoading } = useCompanyReports();
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const lc = q.trim().toLowerCase();
    if (!lc) return reports;
    return reports.filter(
      (r) =>
        r.address.toLowerCase().includes(lc) ||
        (r.owner ?? "").toLowerCase().includes(lc) ||
        (r.delivery?.recipient_name ?? "").toLowerCase().includes(lc) ||
        (r.delivery?.recipient_email ?? "").toLowerCase().includes(lc),
    );
  }, [reports, q]);

  async function open(r: ReportWithLead) {
    setBusyId(r.id);
    try {
      await openStoredReport(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open the report");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search property, owner or recipient…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <span className="text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? "report" : "reports"}
        </span>
        <button
          type="button"
          disabled={rows.length === 0}
          onClick={() => {
            downloadCsv(buildReportCsv(rows), exportFilename("reports-sent"));
            toast.success(`Exported ${rows.length} rows`);
          }}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold text-foreground hover:bg-[var(--bg-hover)] disabled:opacity-50"
          style={{ borderColor: "var(--border)" }}
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>

      <div
        className="overflow-x-auto rounded-xl border"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-12 text-center text-sm text-muted-foreground">
            No reports yet. Generate a savings report from a lead and it lands here with the
            recipient and date.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Property</th>
                <th className="px-5 py-3 font-semibold">Report</th>
                <th className="px-5 py-3 font-semibold">Recipient</th>
                <th className="px-5 py-3 font-semibold">Sent</th>
                <th className="px-5 py-3 font-semibold">Reopened</th>
                <th className="px-5 py-3 text-right font-semibold">Copy</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const Icon = METHOD_ICON[r.delivery?.method ?? "download"] ?? Download;
                return (
                  <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-foreground">{r.address}</div>
                      <div className="text-xs text-muted-foreground">
                        {[r.owner, r.city].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {KIND_LABELS[r.kind] ?? r.kind}
                    </td>
                    <td className="px-5 py-3">
                      {r.delivery?.recipient_name || r.delivery?.recipient_email ? (
                        <>
                          <div className="text-foreground">{r.delivery.recipient_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.delivery.recipient_email ?? ""}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Not recorded</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span>{when(r.delivery?.sent_at ?? r.created_at)}</span>
                      </div>
                      <div className="text-xs">
                        {METHOD_LABELS[r.delivery?.method ?? "download"]}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {when(r.delivery?.downloaded_at)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => open(r)}
                          disabled={busyId === r.id}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold text-foreground hover:bg-[var(--bg-hover)] disabled:opacity-50"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {busyId === r.id ? "Opening…" : "Open"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
