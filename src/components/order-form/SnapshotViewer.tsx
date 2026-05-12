import { type JobOrderSnapshot } from "@/hooks/useOrderForm";
import { fmtMoney, fmtNum } from "@/lib/order-form-calc";
import { X } from "lucide-react";

export function SnapshotViewer({ snapshot, onClose }: { snapshot: JobOrderSnapshot; onClose: () => void }) {
  const t = (snapshot.totals ?? {}) as any;
  const mats = (snapshot.materials ?? []) as any[];
  const labor = (snapshot.labor ?? []) as any[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border bg-[var(--bg-card)] p-6"
        style={{ borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="font-mono text-2xl font-bold text-foreground">v{snapshot.version_number}</div>
            <div className="text-xs text-muted-foreground">
              {snapshot.template_label} · {new Date(snapshot.snapshot_date ?? snapshot.created_at).toLocaleString()}
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-[var(--surface-elevated)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Stat label="Customer $" value={fmtMoney(Number(t.customerPrice ?? 0))} />
          <Stat label="$/SQ" value={snapshot.per_sq_price > 0 ? fmtMoney(snapshot.per_sq_price) : "—"} />
          <Stat label="Cost/SQ" value={snapshot.cost_per_sq > 0 ? fmtMoney(snapshot.cost_per_sq) : "—"} />
          <Stat label={`Profit (${fmtNum(Number(t.margin ?? 0), 1)}%)`} value={fmtMoney(Number(t.profit ?? 0))} />
        </div>

        <Section title="Materials">
          <table className="w-full text-xs">
            <thead><tr className="text-left uppercase text-muted-foreground"><th className="py-1">Line</th><th className="py-1">Product</th><th className="py-1 text-right">Qty</th><th className="py-1 text-right">Unit</th><th className="py-1 text-right">Total</th></tr></thead>
            <tbody>
              {mats.map((r, i) => (
                <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="py-1">{r.label}</td>
                  <td className="py-1 text-muted-foreground">{r.name}</td>
                  <td className="py-1 text-right font-mono">{fmtNum(Number(r.qty))}</td>
                  <td className="py-1 text-right font-mono">{fmtMoney(Number(r.unit_price))}</td>
                  <td className="py-1 text-right font-mono">{fmtMoney(Number(r.line_total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Labor">
          <table className="w-full text-xs">
            <thead><tr className="text-left uppercase text-muted-foreground"><th className="py-1">Task</th><th className="py-1 text-right">Qty</th><th className="py-1 text-right">Rate</th><th className="py-1 text-right">Total</th></tr></thead>
            <tbody>
              {labor.map((r, i) => (
                <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="py-1">{r.task}</td>
                  <td className="py-1 text-right font-mono">{fmtNum(Number(r.qty))}</td>
                  <td className="py-1 text-right font-mono">{fmtMoney(Number(r.rate))}</td>
                  <td className="py-1 text-right font-mono">{fmtMoney(Number(r.line_total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Other Costs">
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <Stat label="Dump" value={fmtMoney(Number(snapshot.dump_cost ?? 0))} />
            <Stat label="Permits" value={fmtMoney(Number(snapshot.permit_cost ?? 0))} />
            <Stat label="Extras" value={fmtMoney((snapshot.extra_costs ?? []).reduce((s, x) => s + Number(x.amount ?? 0), 0))} />
          </div>
        </Section>

        {snapshot.approval_notes && (
          <Section title="Approval Notes">
            <p className="text-xs text-muted-foreground">{snapshot.approval_notes}</p>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-2" style={{ borderColor: "var(--border)" }}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}
