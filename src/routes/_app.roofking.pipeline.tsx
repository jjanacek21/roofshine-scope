import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsRoofKing } from "@/hooks/useRoofKing";
import { useRKAccounts, useRKProperties, useRKTickets } from "@/hooks/roofking/useRKData";
import { TicketDrawer } from "@/components/roofking/TicketDrawer";
import { RK_STATUSES, RK_STATUS_COLORS, RK_STATUS_LABELS } from "@/lib/roofking/types";
import type { RKStatus, RKTicket } from "@/lib/roofking/types";
import { useRKSearch } from "@/components/roofking/RKSearchContext";

export const Route = createFileRoute("/_app/roofking/pipeline")({
  component: PipelinePage,
});

function PipelinePage() {
  const { companyId } = useIsRoofKing();
  const { data: accounts = [] } = useRKAccounts(companyId);
  const { data: properties = [] } = useRKProperties(companyId);
  const { data: tickets = [] } = useRKTickets(companyId);
  const { search } = useRKSearch();
  const qc = useQueryClient();
  const [openTicket, setOpenTicket] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const propById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? tickets.filter((t) => {
        const a = accountById.get(t.account_id);
        const p = propById.get(t.property_id);
        return (
          String(t.wo_number ?? "").includes(q) ||
          (a?.name ?? "").toLowerCase().includes(q) ||
          (p?.name ?? "").toLowerCase().includes(q) ||
          (a?.city ?? "").toLowerCase().includes(q)
        );
      })
    : tickets;

  const byStatus = useMemo(() => {
    const m = new Map<RKStatus, RKTicket[]>();
    for (const s of RK_STATUSES) m.set(s, []);
    for (const t of filtered) m.get(t.status)?.push(t);
    return m;
  }, [filtered]);

  const move = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RKStatus }) => {
      const { error } = await supabase.from("rk_tickets").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rk", "tickets"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const newStatus = e.over?.id ? (String(e.over.id) as RKStatus) : null;
    if (!newStatus) return;
    const t = tickets.find((x) => x.id === id);
    if (!t || t.status === newStatus) return;
    move.mutate({ id, status: newStatus });
  }

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {RK_STATUSES.map((s, idx) => (
            <Column key={s} status={s} delayIdx={idx}>
              {(byStatus.get(s) ?? []).map((t) => {
                const a = accountById.get(t.account_id);
                return (
                  <DraggableCard key={t.id} id={t.id} onOpen={() => setOpenTicket(t.id)}>
                    <div className="flex items-center gap-2">
                      <span className="rk-num text-[11px]" style={{ color: "var(--rk-ink-faint)" }}>WO-{t.wo_number ?? "—"}</span>
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold">{a?.name ?? "—"}</p>
                    <p className="truncate text-xs" style={{ color: "var(--rk-ink-muted)" }}>
                      {propById.get(t.property_id)?.name}{a?.city ? ` · ${a.city}` : ""}
                    </p>
                  </DraggableCard>
                );
              })}
              {(byStatus.get(s) ?? []).length === 0 && (
                <p className="px-2 py-4 text-center text-xs" style={{ color: "var(--rk-ink-faint)" }}>Empty</p>
              )}
            </Column>
          ))}
        </div>
      </DndContext>
      <TicketDrawer ticketId={openTicket} accounts={accounts} properties={properties} onClose={() => setOpenTicket(null)} />
    </>
  );
}

function Column({ status, children, delayIdx }: { status: RKStatus; children: React.ReactNode; delayIdx: number }) {
  const { isOver, setNodeRef } = useDroppable({ id: status });
  const c = RK_STATUS_COLORS[status];
  return (
    <div
      ref={setNodeRef}
      className={`rk-card rk-fade-in delay-${Math.min(delayIdx + 1, 5)} flex flex-col`}
      style={{ borderColor: isOver ? c : undefined, transition: "border-color 0.15s ease" }}
    >
      <div className="flex items-center justify-between border-b p-3" style={{ borderColor: "var(--rk-line)" }}>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: c }} />
          <span className="text-xs font-semibold uppercase tracking-wider">{RK_STATUS_LABELS[status]}</span>
        </div>
      </div>
      <div className="space-y-2 p-3">{children}</div>
    </div>
  );
}

function DraggableCard({ id, children, onOpen }: { id: string; children: React.ReactNode; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (Math.abs((transform?.x ?? 0) + (transform?.y ?? 0)) < 2) onOpen();
        e.stopPropagation();
      }}
      className="rk-panel-2 cursor-grab rounded-lg border p-3 text-left transition-transform hover:-translate-y-0.5"
    >
      {children}
    </div>
  );
}
