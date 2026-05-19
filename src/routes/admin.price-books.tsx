import { createFileRoute, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Layers, DollarSign, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import AdminMacrosPage from "@/routes/admin.macros";
import { MasterCatalogBrowser } from "@/components/catalog/MasterCatalogBrowser";
import { MarketsTab } from "@/components/markets/MarketsTab";

export const Route = createFileRoute("/admin/price-books")({
  component: AdminPricing,
});

function AdminPricing() {
  const [tab, setTab] = useState<"catalog" | "markets" | "macros">("catalog");
  const matchRoute = useMatchRoute();
  const isChild = !matchRoute({ to: "/admin/price-books", fuzzy: false });

  if (isChild) {
    return <Outlet />;
  }

  const tabs = [
    { id: "catalog" as const, label: "Master Catalog", icon: Layers },
    { id: "markets" as const, label: "Markets", icon: MapPin },
    { id: "macros" as const, label: "Master Macros", icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Master Catalog, Markets & Macros</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One shared line-item catalog with per-region price overlays. Each market holds its own unit prices for the same items.
        </p>
      </div>

      <div className="flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                tab === t.id
                  ? "border-[var(--brand)] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "catalog" && <MasterCatalogBrowser />}
      {tab === "markets" && <MarketsTab />}
      {tab === "macros" && <AdminMacrosPage />}
    </div>
  );
}

