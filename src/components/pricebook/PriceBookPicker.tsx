import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, Library } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolvePriceBook, type ResolvedBook } from "@/lib/resolve-price-book";

interface Props {
  companyId: string | null;
  zip: string | null;
  jurisdiction: string | null;
  pricingType?: "insurance" | "retail" | null;
  value: string | null;
  onChange: (id: string | null) => void;
}

export function PriceBookPicker({ companyId, zip, jurisdiction, pricingType, value, onChange }: Props) {
  const [resolved, setResolved] = useState<ResolvedBook | null>(null);
  const [autoApplied, setAutoApplied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await resolvePriceBook({ companyId, zip, jurisdiction, pricingType });
      if (!alive) return;
      setResolved(r);
      if (!value && r && !autoApplied) {
        onChange(r.id);
        setAutoApplied(true);
      }
    })();
    return () => { alive = false; };
  }, [companyId, zip, jurisdiction, pricingType, value, onChange, autoApplied]);

  const { data: allBooks = [] } = useQuery({
    queryKey: ["picker-books", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("price_books")
        .select("id, name, jurisdiction, pricing_type, is_default, company_id")
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("name");
      return data ?? [];
    },
  });

  return (
    <div className="space-y-2">
      <div
        className="flex items-start gap-3 rounded-lg border p-3"
        style={{
          borderColor: resolved ? "var(--success, #10b981)" : "var(--warning, #f59e0b)",
          backgroundColor: "var(--bg-card)",
        }}
      >
        {resolved ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success,#10b981)]" />
        ) : (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning,#f59e0b)]" />
        )}
        <div className="flex-1 text-xs">
          {resolved ? (
            <>
              <p className="font-semibold text-foreground">{resolved.name}</p>
              <p className="text-muted-foreground">{resolved.reason}</p>
            </>
          ) : (
            <p className="text-[var(--warning,#f59e0b)]">No price book matches this job. Pick one manually below or add a master book.</p>
          )}
        </div>
      </div>
      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Override</span>
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="mt-1 h-9 w-full rounded-md border bg-[var(--bg-elevated)] px-2 text-sm text-foreground"
          style={{ borderColor: "var(--border)" }}
        >
          <option value="">— None —</option>
          {allBooks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.is_default ? "★ " : ""}{b.name}{b.jurisdiction ? ` · ${b.jurisdiction}` : ""} · {b.pricing_type}
            </option>
          ))}
        </select>
      </label>
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Library className="h-3 w-3" /> ★ = master/global default available to every company
      </p>
    </div>
  );
}
