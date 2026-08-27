import { createFileRoute } from "@tanstack/react-router";
import { SpfCatalogEditor } from "@/components/spf/SpfCatalogEditor";
import { useIsCompanyAdmin } from "@/hooks/useProfile";
import { useCompanyBrand } from "@/lib/commercial/brand";

export const Route = createFileRoute("/_app/commercial/setup")({
  component: CalculatorSetup,
});

/**
 * Company-facing calculator setup.
 *
 * The calculator starts empty for every new company — no cross-company pricing
 * fallback, by design — which left it with an empty state and nowhere to act on
 * it. This is that missing screen: the same editor the platform admin uses,
 * scoped by RLS to the signed-in user's own company.
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
    <SpfCatalogEditor
      title="Calculator setup"
      description="Your coating products, detail line items, roof systems and field defaults. These numbers are yours alone — nothing here is shared with other companies on the platform."
    />
  );
}
