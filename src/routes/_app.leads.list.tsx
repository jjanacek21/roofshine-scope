import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLeads } from "@/hooks/useLeads";
import { LEAD_STATUSES, fmtNum } from "@/lib/leads";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Input } from "@/components/ui/input";
import { Phone, Mail, MessageSquare, Sparkles, Eye } from "lucide-react";
import { LeadDetailSheet } from "@/components/leads/LeadDetailSheet";
import { useCallPlaybook } from "@/hooks/useCallPlaybook";

export const Route = createFileRoute("/_app/leads/list")({
  component: LeadsList,
});

function LeadsList() {
  const { data: leads = [], isLoading } = useLeads();
  const [tab, setTab] = useState<string>("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const playbook = useCallPlaybook();

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search address, city, owner…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <div className="flex flex-wrap gap-1">
          <TabBtn active={tab === "all"} onClick={() => setTab("all")}>All</TabBtn>
          {LEAD_STATUSES.map((s) => (
            <TabBtn key={s.value} active={tab === s.value} onClick={() => setTab(s.value)}>
              {s.label}
            </TabBtn>
          ))}
        </div>
      </div>

      <div className="rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-12 text-center text-sm text-muted-foreground">No leads.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Property</th>
                <th className="px-5 py-3 font-semibold">City</th>
                <th className="px-5 py-3 font-semibold">Owner</th>
                <th className="px-5 py-3 font-semibold">Sq Ft</th>
                <th className="px-5 py-3 font-semibold">Year</th>
                <th className="px-5 py-3 font-semibold">Roof</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-t transition-colors hover:bg-[var(--bg-hover)]" style={{ borderColor: "var(--border)" }}>
                  <td className="px-5 py-3 font-medium text-foreground">{l.address}</td>
                  <td className="px-5 py-3 text-muted-foreground">{l.city ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{l.owner ?? "—"}</td>
                  <td className="px-5 py-3 font-mono-num text-muted-foreground">{fmtNum(l.sqft)}</td>
                  <td className="px-5 py-3 font-mono-num text-muted-foreground">{l.year_built ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{l.roof_type ?? "—"}</td>
                  <td className="px-5 py-3"><StatusBadge status={l.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn title="Call" onClick={() => playbook.openFor({ id: l.id, address: l.address, city: l.city, owner: l.owner, sqft: l.sqft, roof_type: l.roof_type, year_built: l.year_built })}>
                        <Phone className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn title="Email"><Mail className="h-3.5 w-3.5" /></IconBtn>
                      <IconBtn title="Text"><MessageSquare className="h-3.5 w-3.5" /></IconBtn>
                      <IconBtn title="AI"><Sparkles className="h-3.5 w-3.5" /></IconBtn>
                      <IconBtn title="Open" onClick={() => setOpenId(l.id)}><Eye className="h-3.5 w-3.5" /></IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <LeadDetailSheet leadId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
      style={{
        backgroundColor: active ? "var(--bg-hover)" : "transparent",
        color: active ? "var(--text)" : "var(--text-dim)",
        border: "1px solid var(--border)",
      }}
    >
      {children}
    </button>
  );
}

function IconBtn({ title, children, onClick }: { title: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="rounded-md p-1.5 text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-hover)] hover:text-foreground"
    >
      {children}
    </button>
  );
}
