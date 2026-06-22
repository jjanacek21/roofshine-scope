import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { useLeads } from "@/hooks/useLeads";
import { LEAD_STATUSES, fmtNum, leadStatusColor, type LeadRow, type LeadStatus } from "@/lib/leads";
import { LeadDetailSheet } from "@/components/leads/LeadDetailSheet";
import { useServerFn } from "@tanstack/react-start";
import { updateLeadStatus } from "@/lib/leads.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/leads/pipeline")({
  component: LeadsPipeline,
});

function LeadsPipeline() {
  const { data: leads = [] } = useLeads();
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const updateFn = useServerFn(updateLeadStatus);

  const grouped = useMemo(() => {
    const map: Record<LeadStatus, LeadRow[]> = {
      new: [], contacted: [], qualified: [], quoted: [], report_sent: [], won: [], lost: [], dnc: [],
    };
    leads.forEach((l) => map[l.status]?.push(l));
    return map;
  }, [leads]);

  const updateMut = useMutation({
    mutationFn: (vars: { leadId: string; status: LeadStatus }) =>
      updateFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  function onDragEnd(e: DragEndEvent) {
    const status = e.over?.id as LeadStatus | undefined;
    const leadId = e.active.id as string;
    const lead = leads.find((l) => l.id === leadId);
    if (!status || !lead || lead.status === status) return;
    updateMut.mutate({ leadId, status });
  }

  return (
    <div className="space-y-4">
      <DndContext onDragEnd={onDragEnd}>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(6, minmax(220px, 1fr))" }}>
          {LEAD_STATUSES.map((s) => (
            <Column key={s.value} status={s.value} label={s.label} color={s.color} count={grouped[s.value].length}>
              {grouped[s.value].map((l) => (
                <Card key={l.id} lead={l} onOpen={() => setOpenId(l.id)} />
              ))}
            </Column>
          ))}
        </div>
      </DndContext>
      <LeadDetailSheet leadId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function Column({ status, label, color, count, children }: { status: LeadStatus; label: string; color: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className="flex flex-col gap-2 rounded-xl border p-2"
      style={{
        borderColor: isOver ? color : "var(--border)",
        backgroundColor: "var(--bg-card)",
        minHeight: 400,
      }}
    >
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color }}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          {label}
        </div>
        <span className="rounded font-mono-num text-[10px] font-bold text-muted-foreground" style={{ padding: "2px 6px", background: "var(--bg-hover)" }}>{count}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Card({ lead, onOpen }: { lead: LeadRow; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    borderLeft: `3px solid ${leadStatusColor(lead.status)}`,
  };
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      onDoubleClick={onOpen}
      className="cursor-grab rounded-lg border bg-[var(--bg-elevated)] p-2.5 text-xs shadow-sm transition-colors hover:bg-[var(--bg-hover)] active:cursor-grabbing"
    >
      <div className="font-medium text-foreground">{lead.address}</div>
      <div className="text-muted-foreground">{lead.city}, {lead.state}</div>
      {lead.owner && <div className="mt-1 truncate text-muted-foreground">{lead.owner}</div>}
      {lead.sqft != null && (
        <div className="mt-1 inline-block rounded font-mono-num text-[10px]" style={{ padding: "1px 5px", background: "var(--bg-hover)", color: "var(--text-dim)" }}>
          {fmtNum(lead.sqft)} sf
        </div>
      )}
    </div>
  );
}
