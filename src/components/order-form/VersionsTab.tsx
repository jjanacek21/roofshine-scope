import { useMemo, useState } from "react";
import { useJobOrderSnapshots, useSnapshotMutations, type JobOrderSnapshot, type SnapshotStatus } from "@/hooks/useOrderForm";
import { useProfile } from "@/hooks/useProfile";
import { fmtMoney, fmtNum } from "@/lib/order-form-calc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Send, Undo2, Trash2, GitCompare, Eye, ShieldCheck } from "lucide-react";
import { SnapshotDiff } from "./SnapshotDiff";
import { SnapshotViewer } from "./SnapshotViewer";

const STATUS_COLORS: Record<SnapshotStatus, string> = {
  draft: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  pending_approval: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  superseded: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  rejected: "bg-red-500/15 text-red-300 border-red-500/30",
};
const STATUS_LABEL: Record<SnapshotStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending",
  approved: "Approved",
  superseded: "Superseded",
  rejected: "Rejected",
};

export function VersionsTab({ jobId }: { jobId: string }) {
  const { data: snapshots = [], isLoading } = useJobOrderSnapshots(jobId);
  const { data: profile } = useProfile();
  const isAdmin = profile?.role === "owner" || profile?.role === "admin" || profile?.role === "super_admin";
  const m = useSnapshotMutations(jobId);

  const [viewing, setViewing] = useState<JobOrderSnapshot | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showDiff, setShowDiff] = useState(false);

  const pair = useMemo(() => {
    const a = snapshots.find((s) => s.id === compareIds[0]);
    const b = snapshots.find((s) => s.id === compareIds[1]);
    return a && b ? { a, b } : null;
  }, [snapshots, compareIds]);

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  async function withConfirm(msg: string, fn: () => Promise<void>) {
    if (!confirm(msg)) return;
    try { await fn(); toast.success("Done"); } catch (e: any) { toast.error(e.message); }
  }

  if (isLoading) return <div className="h-32 animate-pulse rounded bg-[var(--surface-elevated)]" />;

  if (snapshots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-base font-bold text-foreground">No snapshots yet</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Save a snapshot from the Build Order tab to capture pricing at a point in time. Snapshots can be submitted for admin approval, then released to crew and suppliers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {snapshots.length} snapshot{snapshots.length === 1 ? "" : "s"} · Select two rows to compare.
        </p>
        {compareIds.length === 2 && (
          <button
            onClick={() => setShowDiff(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-3 py-1.5 text-[13px] font-semibold text-background"
          >
            <GitCompare className="h-4 w-4" /> Compare v{pair?.a.version_number} ↔ v{pair?.b.version_number}
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="w-10 px-3 py-2"></th>
              <th className="px-3 py-2">v#</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Template</th>
              <th className="px-3 py-2 text-right">Customer $</th>
              <th className="px-3 py-2 text-right">$/SQ</th>
              <th className="px-3 py-2 text-right">Profit</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((s) => {
              const t = (s.totals ?? {}) as any;
              const customer = Number(t.customerPrice ?? 0);
              const margin = Number(t.margin ?? 0);
              const checked = compareIds.includes(s.id);
              const isMine = s.created_by === profile?.id;
              return (
                <tr key={s.id} className="border-t hover:bg-[var(--surface-hover)]" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={checked} onChange={() => toggleCompare(s.id)} className="h-4 w-4" />
                  </td>
                  <td className="px-3 py-2 font-mono font-semibold text-foreground">v{s.version_number}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(s.snapshot_date ?? s.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-foreground">{s.template_label ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoney(customer)}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {s.per_sq_price > 0 ? fmtMoney(s.per_sq_price) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-400">{fmtNum(margin, 1)}%</td>
                  <td className="px-3 py-2">
                    <span className={cn("rounded border px-2 py-0.5 text-[10px] font-semibold uppercase", STATUS_COLORS[s.status])}>
                      {STATUS_LABEL[s.status]}
                    </span>
                    {s.status === "approved" && s.approved_at && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {new Date(s.approved_at).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <IconBtn title="View" onClick={() => setViewing(s)}><Eye className="h-3.5 w-3.5" /></IconBtn>
                      <IconBtn
                        title="Rollback to this version"
                        onClick={() => withConfirm(`Roll back the live draft to v${s.version_number}? Your current unsaved work will be replaced.`, () => m.rollback.mutateAsync(s.id))}
                      ><Undo2 className="h-3.5 w-3.5" /></IconBtn>
                      {s.status === "draft" && isMine && (
                        <IconBtn title="Submit for approval" tone="brand" onClick={() => m.submit.mutateAsync(s.id).then(() => toast.success("Submitted")).catch((e) => toast.error(e.message))}>
                          <Send className="h-3.5 w-3.5" />
                        </IconBtn>
                      )}
                      {s.status === "pending_approval" && isAdmin && (
                        <>
                          <IconBtn
                            title="Approve"
                            tone="success"
                            onClick={() => {
                              const note = prompt("Approval note (optional):") ?? undefined;
                              m.approve.mutateAsync({ id: s.id, note }).then(() => toast.success(`v${s.version_number} approved`)).catch((e) => toast.error(e.message));
                            }}
                          ><CheckCircle2 className="h-3.5 w-3.5" /></IconBtn>
                          <IconBtn
                            title="Reject"
                            tone="danger"
                            onClick={() => {
                              const note = prompt("Reason for rejection:") ?? undefined;
                              m.reject.mutateAsync({ id: s.id, note }).then(() => toast.success("Rejected")).catch((e) => toast.error(e.message));
                            }}
                          ><XCircle className="h-3.5 w-3.5" /></IconBtn>
                        </>
                      )}
                      {s.status === "draft" && (isMine || isAdmin) && (
                        <IconBtn
                          title="Delete draft"
                          tone="danger"
                          onClick={() => withConfirm("Delete this draft snapshot?", () => m.remove.mutateAsync(s.id))}
                        ><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground" style={{ borderColor: "var(--border)" }}>
        <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-400" />
        <span>
          Crew Work Order and Supplier Order print views render only the most recently <strong>approved</strong> snapshot. Drafts and pending versions stay internal.
        </span>
      </div>

      {viewing && <SnapshotViewer snapshot={viewing} onClose={() => setViewing(null)} />}
      {showDiff && pair && <SnapshotDiff a={pair.a} b={pair.b} onClose={() => setShowDiff(false)} />}
    </div>
  );
}

function IconBtn({
  children, onClick, title, tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  tone?: "default" | "brand" | "success" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "rounded p-1.5 transition-colors",
        tone === "default" && "text-muted-foreground hover:bg-[var(--surface-elevated)] hover:text-foreground",
        tone === "brand" && "bg-[var(--brand)]/15 text-[var(--brand)] hover:bg-[var(--brand)]/25",
        tone === "success" && "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25",
        tone === "danger" && "text-muted-foreground hover:bg-red-500/15 hover:text-red-300",
      )}
    >
      {children}
    </button>
  );
}
