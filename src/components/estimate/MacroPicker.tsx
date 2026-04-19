import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layers, X } from "lucide-react";

export type MacroPickerItem = {
  line_item_master_id: string;
  code: string;
  name: string;
  trade: string;
  unit: string;
  qty: number;
  unit_price: number;
};

export type MacroOption = {
  id: string;
  name: string;
  description: string | null;
  trade: string | null;
  items: MacroPickerItem[];
};

export function MacroPicker({
  companyId, onPick, onClose,
}: { companyId: string; onPick: (items: MacroPickerItem[], macroName: string) => void; onClose: () => void }) {
  const { data: macros = [], isLoading } = useQuery({
    queryKey: ["macro-picker", companyId],
    queryFn: async () => {
      const { data: ms } = await supabase
        .from("master_macros")
        .select("id, name, description, trade")
        .order("name");

      if (!ms || ms.length === 0) return [];

      const { data: itemRows } = await supabase
        .from("master_macro_items")
        .select("macro_id, qty, unit, line_item_master_id, line_item_master:line_item_master_id(id, code, name, unit, default_price, trade)")
        .in("macro_id", ms.map((m) => m.id));

      const { data: pricing } = await supabase
        .from("company_macro_pricing")
        .select("macro_id, line_item_master_id, unit_price")
        .eq("company_id", companyId);
      const priceMap = new Map(
        (pricing ?? []).map((p) => [`${p.macro_id}::${p.line_item_master_id}`, Number(p.unit_price)]),
      );

      return ms.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        trade: m.trade,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: ((itemRows ?? []) as any[])
          .filter((r) => r.macro_id === m.id)
          .map((r) => {
            const li = r.line_item_master;
            const myPrice = priceMap.get(`${m.id}::${r.line_item_master_id}`);
            return {
              line_item_master_id: r.line_item_master_id,
              code: li?.code ?? "",
              name: li?.name ?? "",
              trade: li?.trade ?? "",
              unit: r.unit ?? li?.unit ?? "EA",
              qty: Number(r.qty),
              unit_price: myPrice ?? Number(li?.default_price ?? 0),
            } as MacroPickerItem;
          }),
      })) as MacroOption[];
    },
  });

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/60" onClick={onClose} />
      <div
        className="fixed right-0 top-0 z-40 h-full w-full max-w-xl overflow-y-auto border-l p-6"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[var(--brand)]" />
            <h2 className="text-lg font-bold">Insert Macro</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick a bundle to insert all its line items into this estimate at once.
        </p>

        {isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : macros.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No macros available yet.</p>
        ) : (
          <div className="mt-5 space-y-3">
            {macros.map((m) => (
              <button
                key={m.id}
                onClick={() => onPick(m.items, m.name)}
                disabled={m.items.length === 0}
                className="w-full rounded-xl border p-4 text-left transition hover:border-[var(--brand)] hover:bg-[var(--surface-hover)] disabled:opacity-40"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-semibold">{m.name}</h3>
                  <span className="rounded bg-[var(--surface-elevated)] px-2 py-0.5 text-[10px] text-muted-foreground">
                    {m.items.length} item{m.items.length === 1 ? "" : "s"}
                  </span>
                </div>
                {m.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{m.description}</p>}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
