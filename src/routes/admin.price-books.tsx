import { createFileRoute, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Layers, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import AdminMacrosPage from "@/routes/admin.macros";
import { MasterCatalogBrowser } from "@/components/catalog/MasterCatalogBrowser";

export const Route = createFileRoute("/admin/price-books")({
  component: AdminPricing,
});

function AdminPricing() {
  const [tab, setTab] = useState<"catalog" | "macros">("catalog");
  const matchRoute = useMatchRoute();
  const isChild = !matchRoute({ to: "/admin/price-books", fuzzy: false });

  if (isChild) {
    return <Outlet />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Master Catalog & Macros</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The hierarchical line item catalog (Domain → Subgroup → Item) and reusable assemblies built from it.
        </p>
      </div>

      <div className="flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => setTab("catalog")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            tab === "catalog"
              ? "border-[var(--brand)] text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Layers className="h-4 w-4" /> Master Catalog
        </button>
        <button
          onClick={() => setTab("macros")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            tab === "macros"
              ? "border-[var(--brand)] text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <DollarSign className="h-4 w-4" /> Master Macros
        </button>
      </div>

      {tab === "catalog" ? <MasterCatalogBrowser /> : <AdminMacrosPage />}
    </div>
  );
}
