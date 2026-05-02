import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, Mail, MessageSquare, Search, ExternalLink, Clock } from "lucide-react";
import { listFollowUps, type FollowUpItem } from "@/server/leads.functions";
import { LeadDetailSheet } from "@/components/leads/LeadDetailSheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/leads/followup")({
  component: FollowUpPage,
});

type ChannelFilter = "all" | "email" | "text";

function FollowUpPage() {
  const { data: leads = [] } = useLeads();
  const { data, isLoading } = useQuery({
    queryKey: ["followups"],
    queryFn: () => listFollowUps(),
  });

  const items = data?.items ?? [];
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [search, setSearch] = useState("");
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  const openLead = useMemo(
    () => (openLeadId ? leads.find((l) => l.id === openLeadId) ?? null : null),
    [openLeadId, leads],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (channel !== "all" && it.channel !== channel) return false;
      if (!q) return true;
      const hay = `${it.address} ${it.city ?? ""} ${it.owner ?? ""} ${it.recipient ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, channel, search]);

  // KPIs
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const totalSent = items.length;
  const thisWeek = items.filter((i) => new Date(i.sentAt).getTime() >= weekAgo).length;
  const awaiting = items.filter((i) => i.followupCount === 0).length;
  const converted = items.filter((i) => ["qualified", "quoted", "won"].includes(i.status)).length;

  return (
    <div className="space-y-5">
      <header className="flex items-start gap-3">
        <div
          className="grid h-10 w-10 place-items-center rounded-xl"
          style={{ backgroundColor: "color-mix(in oklab, var(--primary) 14%, transparent)" }}
        >
          <Send className="h-5 w-5 text-[var(--primary)]" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Follow-Up</h2>
          <p className="text-sm text-[var(--text-dim)]">
            Contacts who accepted a free damage / savings report. Work this list daily.
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Reports sent" value={totalSent} accent="var(--primary)" />
        <Kpi label="Sent this week" value={thisWeek} accent="#22c55e" />
        <Kpi label="Awaiting reply" value={awaiting} accent="#f59e0b" />
        <Kpi label="Converted" value={converted} accent="#a855f7" />
      </div>

      <div
        className="flex flex-wrap items-center gap-2 rounded-xl border p-2"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-dim)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search address, owner, recipient…"
            className="h-9 w-full rounded-md border bg-[var(--bg-elevated)] pl-8 pr-3 text-sm"
            style={{ borderColor: "var(--border)" }}
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border p-1" style={{ borderColor: "var(--border)" }}>
          {(["all", "email", "text"] as ChannelFilter[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                channel === c
                  ? "bg-[var(--bg-hover)] text-foreground"
                  : "text-[var(--text-dim)] hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        {isLoading ? (
          <div className="p-10 text-center text-sm text-[var(--text-dim)]">Loading follow-ups…</div>
        ) : filtered.length === 0 ? (
          <EmptyState hasAny={items.length > 0} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-[var(--text-dim)]"
                  style={{ borderColor: "var(--border)" }}>
                <th className="px-3 py-2 font-semibold">Lead</th>
                <th className="px-3 py-2 font-semibold">Channel</th>
                <th className="px-3 py-2 font-semibold">Sent</th>
                <th className="px-3 py-2 font-semibold">Last reply</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => (
                <Row key={`${it.leadId}-${it.sentAt}`} item={it} onOpen={() => setOpenLeadId(it.leadId)} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {openLead && (
        <LeadDetailSheet lead={openLead} open={!!openLead} onClose={() => setOpenLeadId(null)} />
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold" style={{ color: accent }}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function Row({ item, onOpen }: { item: FollowUpItem; onOpen: () => void }) {
  const sent = new Date(item.sentAt);
  const daysSince = Math.floor((Date.now() - sent.getTime()) / (24 * 60 * 60 * 1000));
  const lastReply = item.lastReplyAt ? new Date(item.lastReplyAt) : null;

  return (
    <tr className="border-b transition-colors hover:bg-[var(--bg-hover)]" style={{ borderColor: "var(--border)" }}>
      <td className="px-3 py-2.5">
        <button
          type="button"
          onClick={onOpen}
          className="text-left"
        >
          <div className="font-medium text-foreground">{item.address}</div>
          <div className="text-xs text-[var(--text-dim)]">
            {[item.city, item.state].filter(Boolean).join(", ")}
            {item.owner ? ` · ${item.owner}` : ""}
          </div>
        </button>
      </td>
      <td className="px-3 py-2.5">
        <ChannelBadge channel={item.channel} recipient={item.recipient} />
      </td>
      <td className="px-3 py-2.5">
        <div className="text-foreground">{sent.toLocaleDateString()}</div>
        <div className="text-xs text-[var(--text-dim)] inline-flex items-center gap-1">
          <Clock className="h-3 w-3" /> {daysSince === 0 ? "today" : `${daysSince}d ago`}
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs">
        {lastReply ? (
          <span className="text-foreground">{lastReply.toLocaleDateString()}</span>
        ) : (
          <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold"
                style={{ backgroundColor: "color-mix(in oklab, #f59e0b 18%, transparent)", color: "#f59e0b" }}>
            Awaiting
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge status={item.status} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold text-[var(--text-dim)] hover:text-foreground"
          style={{ borderColor: "var(--border)" }}
        >
          Open <ExternalLink className="h-3 w-3" />
        </button>
      </td>
    </tr>
  );
}

function ChannelBadge({ channel, recipient }: { channel: FollowUpItem["channel"]; recipient: string | null }) {
  const cfg =
    channel === "email"
      ? { icon: Mail, color: "#3b82f6", label: "Email" }
      : channel === "text"
        ? { icon: MessageSquare, color: "#22c55e", label: "Text" }
        : { icon: Send, color: "#94a3b8", label: "Sent" };
  const Icon = cfg.icon;
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold"
        style={{ backgroundColor: `color-mix(in oklab, ${cfg.color} 18%, transparent)`, color: cfg.color }}
      >
        <Icon className="h-3 w-3" /> {cfg.label}
      </span>
      {recipient && (
        <span className="font-mono text-[11px] text-[var(--text-dim)]">{recipient}</span>
      )}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  new: "#94a3b8",
  contacted: "#3b82f6",
  qualified: "#22c55e",
  quoted: "#a855f7",
  report_sent: "#0ea5e9",
  won: "#16a34a",
  lost: "#ef4444",
  dnc: "#71717a",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#94a3b8";
  return (
    <span
      className="inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold capitalize"
      style={{ backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="px-6 py-14 text-center">
      <Send className="mx-auto h-8 w-8 text-[var(--text-dim)]" />
      <h3 className="mt-3 text-base font-semibold text-foreground">
        {hasAny ? "Nothing matches those filters" : "No reports sent yet"}
      </h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-[var(--text-dim)]">
        {hasAny
          ? "Try clearing the search or switching the channel filter."
          : "Generate a savings or damage report and email it to a contact to start tracking follow-ups here."}
      </p>
    </div>
  );
}
