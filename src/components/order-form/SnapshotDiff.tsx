import { type JobOrderSnapshot } from "@/hooks/useOrderForm";
import { fmtMoney, fmtNum } from "@/lib/order-form-calc";
import { cn } from "@/lib/utils";
import { X, ArrowRight } from "lucide-react";

export function SnapshotDiff({ a, b, onClose }: { a: JobOrderSnapshot; b: JobOrderSnapshot; onClose: () => void }) {
  // a is older, b is newer (or vice versa) — order by version_number ascending so deltas read left→right
  const [older, newer] = a.version_number <= b.version_number ? [a, b] : [b, a];
  const tA = (older.totals ?? {}) as any;
  const tB = (newer.totals ?? {}) as any;

  function totalsRow(label: string, va: number, vb: number, money = true) {
    const delta = vb - va;
    return (
      <tr className="border-t" style={{ borderColor: "var(--border)" }}>
        <td className="py-1.5 text-foreground">{label}</td>
        <td className="py-1.5 text-right font-mono">{money ? fmtMoney(va) : fmtNum(va, 1)}</td>
        <td className="py-1.5 text-right font-mono">{money ? fmtMoney(vb) : fmtNum(vb, 1)}</td>
        <td className={cn("py-1.5 text-right font-mono font-semibold", delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-muted-foreground")}>
          {delta === 0 ? "—" : (delta > 0 ? "+" : "") + (money ? fmtMoney(delta) : fmtNum(delta, 1))}
        </td>
      </tr>
    );
  }

  // Line-level diff for materials by `label`
  const matsA = new Map<string, any>();
  (older.materials ?? []).forEach((r: any) => matsA.set(r.label, r));
  const matsB = new Map<string, any>();
  (newer.materials ?? []).forEach((r: any) => matsB.set(r.label, r));
  const allMatLabels = Array.from(new Set([...matsA.keys(), ...matsB.keys()]));

  const labA = new Map<string, any>();
  (older.labor ?? []).forEach((r: any) => labA.set(r.task, r));
  const labB = new Map<string, any>();
  (newer.labor ?? []).forEach((r: any) => labB.set(r.task, r));
  const allLabTasks = Array.from(new Set([...labA.keys(), ...labB.keys()]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border bg-[var(--bg-card)] p-6"
        style={{ borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 font-mono text-2xl font-bold text-foreground">
              v{older.version_number} <ArrowRight className="h-5 w-5" /> v{newer.version_number}
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(older.snapshot_date ?? older.created_at).toLocaleDateString()} →{" "}
              {new Date(newer.snapshot_date ?? newer.created_at).toLocaleDateString()}
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-[var(--surface-elevated)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-6">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Totals</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-1">Metric</th>
                <th className="py-1 text-right">v{older.version_number}</th>
                <th className="py-1 text-right">v{newer.version_number}</th>
                <th className="py-1 text-right">Δ</th>
              </tr>
            </thead>
            <tbody>
              {totalsRow("Materials Total", Number(tA.matTotal ?? 0), Number(tB.matTotal ?? 0))}
              {totalsRow("Labor Total", Number(tA.laborTotal ?? 0), Number(tB.laborTotal ?? 0))}
              {totalsRow("Dump", Number(older.dump_cost ?? 0), Number(newer.dump_cost ?? 0))}
              {totalsRow("Permits", Number(older.permit_cost ?? 0), Number(newer.permit_cost ?? 0))}
              {totalsRow("Job Cost", Number(tA.jobCost ?? 0), Number(tB.jobCost ?? 0))}
              {totalsRow("Customer Price", Number(tA.customerPrice ?? 0), Number(tB.customerPrice ?? 0))}
              {totalsRow("$ / SQ", Number(older.per_sq_price ?? 0), Number(newer.per_sq_price ?? 0))}
              {totalsRow("Profit %", Number(tA.margin ?? 0), Number(tB.margin ?? 0), false)}
            </tbody>
          </table>
        </div>

        <DiffTable
          title="Materials"
          rows={allMatLabels.map((k) => ({
            label: k,
            qtyA: Number(matsA.get(k)?.qty ?? 0),
            qtyB: Number(matsB.get(k)?.qty ?? 0),
            priceA: Number(matsA.get(k)?.unit_price ?? 0),
            priceB: Number(matsB.get(k)?.unit_price ?? 0),
            totA: Number(matsA.get(k)?.line_total ?? 0),
            totB: Number(matsB.get(k)?.line_total ?? 0),
          }))}
          va={older.version_number}
          vb={newer.version_number}
        />

        <DiffTable
          title="Labor"
          rows={allLabTasks.map((k) => ({
            label: k,
            qtyA: Number(labA.get(k)?.qty ?? 0),
            qtyB: Number(labB.get(k)?.qty ?? 0),
            priceA: Number(labA.get(k)?.rate ?? 0),
            priceB: Number(labB.get(k)?.rate ?? 0),
            totA: Number(labA.get(k)?.line_total ?? 0),
            totB: Number(labB.get(k)?.line_total ?? 0),
          }))}
          va={older.version_number}
          vb={newer.version_number}
        />
      </div>
    </div>
  );
}

function DiffTable({
  title, rows, va, vb,
}: {
  title: string;
  rows: Array<{ label: string; qtyA: number; qtyB: number; priceA: number; priceB: number; totA: number; totB: number }>;
  va: number; vb: number;
}) {
  return (
    <div className="mt-6">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left uppercase text-muted-foreground">
              <th className="px-2 py-1.5">Line</th>
              <th className="px-2 py-1.5 text-right">v{va} Qty</th>
              <th className="px-2 py-1.5 text-right">v{vb} Qty</th>
              <th className="px-2 py-1.5 text-right">v{va} Unit</th>
              <th className="px-2 py-1.5 text-right">v{vb} Unit</th>
              <th className="px-2 py-1.5 text-right">v{va} Total</th>
              <th className="px-2 py-1.5 text-right">v{vb} Total</th>
              <th className="px-2 py-1.5 text-right">Δ Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const dTot = r.totB - r.totA;
              const added = r.totA === 0 && r.totB > 0;
              const removed = r.totB === 0 && r.totA > 0;
              return (
                <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className={cn("px-2 py-1", added && "text-emerald-400", removed && "text-red-400 line-through")}>{r.label}</td>
                  <td className="px-2 py-1 text-right font-mono">{fmtNum(r.qtyA, 1)}</td>
                  <td className="px-2 py-1 text-right font-mono">{fmtNum(r.qtyB, 1)}</td>
                  <td className="px-2 py-1 text-right font-mono">{fmtMoney(r.priceA)}</td>
                  <td className="px-2 py-1 text-right font-mono">{fmtMoney(r.priceB)}</td>
                  <td className="px-2 py-1 text-right font-mono">{fmtMoney(r.totA)}</td>
                  <td className="px-2 py-1 text-right font-mono">{fmtMoney(r.totB)}</td>
                  <td className={cn("px-2 py-1 text-right font-mono font-semibold", dTot > 0 ? "text-emerald-400" : dTot < 0 ? "text-red-400" : "text-muted-foreground")}>
                    {dTot === 0 ? "—" : (dTot > 0 ? "+" : "") + fmtMoney(dTot)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
