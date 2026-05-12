import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLeads } from "@/hooks/useLeads";
import { useProfile } from "@/hooks/useProfile";
import { LEAD_STATUSES, fmtNum } from "@/lib/leads";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Phone, Mail, MessageSquare, Sparkles, Eye, Trash2, X, Upload } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { LeadDetailSheet } from "@/components/leads/LeadDetailSheet";
import { useCallPlaybook } from "@/hooks/useCallPlaybook";
import { useCompanyMembers, memberName } from "@/hooks/useCompanyMembers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/leads/list")({
  component: LeadsList,
});

function LeadsList() {
  const { data: leads = [], isLoading } = useLeads();
  const { data: profile } = useProfile();
  const isAdmin =
    profile?.role === "owner" ||
    profile?.role === "admin" ||
    profile?.role === "super_admin";
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const playbook = useCallPlaybook();
  const { data: members = [] } = useCompanyMembers();
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const reassignLead = useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      const { error } = await supabase.from("leads").update({ assigned_to: userId }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead reassigned");
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Reassign failed"),
  });

  const filtered = useMemo(() => {
    let rows = tab === "all" ? leads : leads.filter((l) => l.status === tab);
    if (q.trim()) {
      const lc = q.toLowerCase();
      rows = rows.filter(
        (l) =>
          l.address.toLowerCase().includes(lc) ||
          (l.city ?? "").toLowerCase().includes(lc) ||
          (l.owner ?? "").toLowerCase().includes(lc),
      );
    }
    return rows;
  }, [leads, tab, q]);

  const allChecked = filtered.length > 0 && filtered.every((l) => selected.has(l.id));
  const someChecked = filtered.some((l) => selected.has(l.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = filtered.every((l) => next.has(l.id));
      if (allOn) filtered.forEach((l) => next.delete(l.id));
      else filtered.forEach((l) => next.add(l.id));
      return next;
    });
  }

  const deleteMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("leads").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`Deleted ${ids.length} lead${ids.length === 1 ? "" : "s"}`);
      setSelected(new Set());
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search address, city, owner…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex flex-wrap gap-1">
          <TabBtn active={tab === "all"} onClick={() => setTab("all")}>All</TabBtn>
          {LEAD_STATUSES.map((s) => (
            <TabBtn key={s.value} active={tab === s.value} onClick={() => setTab(s.value)}>
              {s.label}
            </TabBtn>
          ))}
        </div>
        <Link
          to="/leads/import"
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}
        >
          <Upload className="h-3.5 w-3.5" />
          Import addresses
        </Link>
      </div>

      {selected.size > 0 && (
        <div
          className="flex items-center justify-between rounded-lg border px-4 py-2"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "color-mix(in oklab, var(--brand) 12%, var(--bg-card))",
          }}
        >
          <div className="text-sm font-medium text-foreground">
            {selected.size} selected
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-[var(--bg-hover)]"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                style={{ backgroundColor: "#ef4444" }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
          </div>
        </div>
      )}

      <div
        className="rounded-xl border"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-12 text-center text-sm text-muted-foreground">No leads.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="w-10 px-5 py-3">
                  <Checkbox
                    checked={allChecked ? true : someChecked ? "indeterminate" : false}
                    onCheckedChange={() => toggleAll()}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-5 py-3 font-semibold">Property</th>
                <th className="px-5 py-3 font-semibold">City</th>
                <th className="px-5 py-3 font-semibold">Owner</th>
                <th className="px-5 py-3 font-semibold">Sq Ft</th>
                <th className="px-5 py-3 font-semibold">Year</th>
                <th className="px-5 py-3 font-semibold">Roof</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Rep</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  className="border-t transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-5 py-3">
                    <Checkbox
                      checked={selected.has(l.id)}
                      onCheckedChange={() => toggleOne(l.id)}
                      aria-label="Select row"
                    />
                  </td>
                  <td className="px-5 py-3 font-medium text-foreground">{l.address}</td>
                  <td className="px-5 py-3 text-muted-foreground">{l.city ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{l.owner ?? "—"}</td>
                  <td className="px-5 py-3 font-mono-num text-muted-foreground">{fmtNum(l.sqft)}</td>
                  <td className="px-5 py-3 font-mono-num text-muted-foreground">{l.year_built ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{l.roof_type ?? "—"}</td>
                  <td className="px-5 py-3"><StatusBadge status={l.status} /></td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {(() => {
                      const lr = l as unknown as { assigned_to?: string | null; created_by?: string | null };
                      const repId = lr.assigned_to ?? lr.created_by ?? "";
                      if (isAdmin) {
                        return (
                          <select
                            value={lr.assigned_to ?? ""}
                            onChange={(e) => reassignLead.mutate({ id: l.id, userId: e.target.value })}
                            className="rounded border bg-transparent px-2 py-1 text-xs text-foreground"
                            style={{ borderColor: "var(--border)" }}
                          >
                            <option value="">—</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>{memberName(m)}</option>
                            ))}
                          </select>
                        );
                      }
                      return memberName(memberMap.get(repId));
                    })()}
                  </td>
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
                      <IconBtn title="Email"><Mail className="h-3.5 w-3.5" /></IconBtn>
                      <IconBtn title="Text"><MessageSquare className="h-3.5 w-3.5" /></IconBtn>
                      <IconBtn title="AI"><Sparkles className="h-3.5 w-3.5" /></IconBtn>
                      <IconBtn title="Open" onClick={() => setOpenId(l.id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <LeadDetailSheet leadId={openId} onClose={() => setOpenId(null)} />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} lead{selected.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected leads, their contacts, notes, activity, reports and uploaded files. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMut.mutate(Array.from(selected))}
              className="bg-[#ef4444] text-white hover:bg-[#dc2626]"
            >
              {deleteMut.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TabBtn({
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
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[var(--bg-hover)] hover:text-foreground"
    >
      {children}
    </button>
  );
}
