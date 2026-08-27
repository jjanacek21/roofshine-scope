import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { SpfCatalogEditor } from "@/components/spf/SpfCatalogEditor";
import { useIsCompanyAdmin } from "@/hooks/useProfile";
import { useCompanyBrand } from "@/lib/commercial/brand";
import { fetchSpfCatalog } from "@/lib/spf/catalog";
import { spfTemplateInfo, seedSpfFromTemplate } from "@/lib/spf/seed.functions";

export const Route = createFileRoute("/_app/commercial/setup")({
  component: CalculatorSetup,
});

/**
 * Company-facing calculator setup.
 *
 * The calculator starts empty for every new company — no cross-company pricing
 * fallback, by design — which left it with an empty state and nowhere to act on
 * it. This is that missing screen: the same editor the platform admin uses,
 * scoped by RLS to the signed-in user's own company, plus a one-click way to
 * start from the platform catalog with every price zeroed.
 */
function CalculatorSetup() {
  const isAdmin = useIsCompanyAdmin();
  const brand = useCompanyBrand();

  if (!isAdmin) {
    return (
      <div className="rk-card p-8 text-center">
        <p className="text-base font-semibold">Calculator setup is admin-only</p>
        <p className="mt-1 text-sm" style={{ color: "var(--rk-ink-faint)" }}>
          Ask an owner or admin at {brand.name || "your company"} to add your roof systems and
          pricing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SeedPanel />
      <SpfCatalogEditor
        title="Calculator setup"
        description="Your coating products, detail line items, roof systems and field defaults. These numbers are yours alone — nothing here is shared with other companies on the platform."
      />
    </div>
  );
}

/**
 * Offered only while the catalog is empty. Once there are products, seeding
 * would either duplicate them or overwrite real work, so the panel disappears
 * rather than sitting there as a trap.
 */
function SeedPanel() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: catalog } = useQuery({
    queryKey: ["spf-catalog"],
    queryFn: () => fetchSpfCatalog(),
  });

  const { data: template } = useQuery({
    queryKey: ["spf-template-info"],
    queryFn: () => spfTemplateInfo(),
    staleTime: 5 * 60 * 1000,
  });

  const isEmpty = !!catalog && catalog.products.length === 0;
  if (!isEmpty || !template?.available) return null;

  async function seed() {
    setBusy(true);
    try {
      const r = await seedSpfFromTemplate();
      toast.success(
        `Loaded ${r.products} products, ${r.details} detail items and ${r.stacks} roof systems — all prices at zero.`,
      );
      qc.invalidateQueries({ queryKey: ["spf-catalog"] });
      qc.invalidateQueries({ queryKey: ["spf-template-info"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load the template");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="rk-card flex flex-wrap items-center gap-4 p-5"
      style={{ borderColor: "var(--rk-line-2)" }}
    >
      <div className="min-w-[260px] flex-1">
        <p className="text-base font-semibold">Start from the standard catalog</p>
        <p className="mt-1 text-sm" style={{ color: "var(--rk-ink-muted)" }}>
          Loads the same {template.products} coating products, {template.details} detail line items
          and {template.stacks} roof systems the platform runs on, with every price, wage and markup
          set to zero. The estimating logic is ready; you fill in your own numbers. Production rates
          and coverage figures come across as-is, since those are physics, not pricing.
        </p>
      </div>
      <button
        type="button"
        onClick={seed}
        disabled={busy}
        className="rk-btn rk-btn-primary shrink-0 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {busy ? "Loading…" : "Load the catalog"}
      </button>
    </div>
  );
}
