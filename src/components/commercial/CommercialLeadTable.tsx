import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Phone, FileText, Upload, Send, ArrowRight, ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLeads } from "@/hooks/useLeads";
import { useCallPlaybook } from "@/hooks/useCallPlaybook";
import { LeadDetailSheet } from "@/components/leads/LeadDetailSheet";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Input } from "@/components/ui/input";
import { fmtNum, leadStatusLabel, type LeadRow, type LeadStatus } from "@/lib/leads";
import { buildLeadCsv, downloadCsv, exportFilename } from "@/lib/commercial/lead-export";

export type CommercialLeadTableProps = {
  /** Statuses this view owns. */
  statuses: readonly LeadStatus[];
  /** Status filter chips (leads view only). */
  showStatusFilter?: boolean;
  /** Show follow-up date + last report columns. */
  showPipelineColumns?: boolean;
  /** Label + target status for the move action. */
  moveAction: { label: string; to: LeadStatus; direction: "forward" | "back" };
  emptyText: string;
};

export function CommercialLeadTable({
  statuses,
  showStatusFilter = false,
  showPipelineColumns = false,
  moveAction,
  emptyText,
}: CommercialLeadTableProps) {
  const { data: leads = [], isLoading } = useLeads();
  const qc = useQueryClient();
  const playbook = useCallPlaybook();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const scoped = useMemo(
    () => leads.filter((l) => (statuses as readonly string[]).includes(l.status)),
    [leads, statuses],
  );

  const rows = useMemo(() => {
    let out: LeadRow[] = status === "all" ? scoped : scoped.filter((l) => l.status === status);
    const lc = q.trim().toLowerCase();
    if (lc) {
      out = out.filter(
        (l) =>
          l.address.toLowerCase().includes(lc) ||
          (l.city ?? "").toLowerCase().includes(lc) ||
          (l.owner ?? "").toLowerCase().includes(lc),
      );
    }
    return out;
  }, [scoped, status, q]);

  const move = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").update({ status: moveAction.to }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Moved to ${leadStatusLabel(moveAction.to)}`);
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead-stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const MoveIcon = moveAction.direction === "forward" ? ArrowRight : ArrowLeft;

  /**
   * Exports exactly what is on screen — the search box and status chips are
   * the selection. Working a filtered slice and getting the whole database
   * back would be the wrong answer for a CRM import.
   */
  async function exportCsv() {
    if (rows.length === 0) return;
    setExporting(true);
    try {
      const csv = await buildLeadCsv(rows);
      downloadCsv(csv, exportFilename("leads"));
      toast.success(`Exported ${rows.length} ${rows.length === 1 ? "lead" : "leads"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search address, city, owner…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        {showStatusFilter && (
          <div className="flex flex-wrap gap-1">
            <Chip active={status === "all"} onClick={() => setStatus("all")}>
              All
            </Chip>
            {statuses.map((s) => (
              <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
                {leadStatusLabel(s)}
              </Chip>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting || rows.length === 0}
            title="Download the leads shown here, one row per contact"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold text-foreground hover:bg-[var(--bg-hover)] disabled:opacity-50"
            style={{ borderColor: "var(--border)" }}
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
          <Link
            to="/leads/import"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold text-foreground hover:bg-[var(--bg-hover)]"
            style={{ borderColor: "var(--border)" }}
          >
            <Upload className="h-3.5 w-3.5" /> Import addresses
          </Link>
          <Link
            to="/leads/followup"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold text-foreground hover:bg-[var(--bg-hover)]"
            style={{ borderColor: "var(--border)" }}
          >
            <Send className="h-3.5 w-3.5" /> Outreach
          </Link>
        </div>
      </div>

      <div
        className="overflow-x-auto rounded-xl border"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-12 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Property</th>
                <th className="px-5 py-3 font-semibold">City</th>
                <th className="px-5 py-3 font-semibold">Owner</th>
                <th className="px-5 py-3 font-semibold">Sq Ft</th>
                <th className="px-5 py-3 font-semibold">Roof</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                {showPipelineColumns && <th className="px-5 py-3 font-semibold">Follow-up</th>}
                {showPipelineColumns && <th className="px-5 py-3 font-semibold">Last report</th>}
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const extra = l as unknown as {
                  follow_up_date?: string | null;
                  last_report_at?: string | null;
                };
                return (
                  <tr
                    key={l.id}
                    className="border-t transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-5 py-3 font-medium text-foreground">{l.address}</td>
                    <td className="px-5 py-3 text-muted-foreground">{l.city ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{l.owner ?? "—"}</td>
                    <td className="px-5 py-3 font-mono-num text-muted-foreground">
                      {fmtNum(l.sqft)}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{l.roof_type ?? "—"}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={l.status} />
                    </td>
                    {showPipelineColumns && (
                      <td className="px-5 py-3 text-muted-foreground">
                        {extra.follow_up_date
                          ? new Date(extra.follow_up_date).toLocaleDateString()
                          : "—"}
                      </td>
                    )}
                    {showPipelineColumns && (
                      <td className="px-5 py-3 text-muted-foreground">
                        {extra.last_report_at
                          ? new Date(extra.last_report_at).toLocaleDateString()
                          : "—"}
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <IconBtn
                          title="Call"
                          onClick={() =>
                            playbook.openFor({
                              id: l.id,
                              address: l.address,
                              city: l.city,
                              owner: l.owner,
                              sqft: l.sqft,
                              roof_type: l.roof_type,
                              year_built: l.year_built,
                            })
                          }
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </IconBtn>
                        <Link
                          to="/leads/savings"
                          search={{ leadId: l.id }}
                          title="Savings report"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--bg-hover)] hover:text-foreground"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Link>
                        <IconBtn title="Open" onClick={() => setOpenId(l.id)}>
                          <Eye className="h-3.5 w-3.5" />
                        </IconBtn>
                        <button
                          type="button"
                          onClick={() => move.mutate(l.id)}
                          disabled={move.isPending}
                          className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold text-foreground hover:bg-[var(--bg-hover)] disabled:opacity-50"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <MoveIcon className="h-3 w-3" />
                          {moveAction.label}
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

      <LeadDetailSheet leadId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors " +
        (active
          ? "border-transparent bg-[var(--brand)] text-white"
          : "border-[var(--border)] text-muted-foreground hover:bg-[var(--bg-hover)]")
      }
    >
      {children}
    </button>
  );
}

function IconBtn({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--bg-hover)] hover:text-foreground"
    >
      {children}
    </button>
  );
}
