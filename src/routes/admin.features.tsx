import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FeatureTree } from "@/components/admin/FeatureTree";
import { loadFeatureAdmin } from "@/lib/features-admin.functions";

export const Route = createFileRoute("/admin/features")({
  component: FeaturesAdmin,
});

function FeaturesAdmin() {
  const load = useServerFn(loadFeatureAdmin);
  const [search, setSearch] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["feature-admin"], queryFn: () => load() });

  const companies = (data?.companies ?? []).filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase()),
  );
  const selected = data?.companies.find((c) => c.id === companyId);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Feature Flags</h1>
        <p className="text-sm text-muted-foreground">
          Grant platform features per company. Turning a parent off hides its children without
          erasing their settings.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search companies"
              className="pl-8"
            />
          </div>
          <div className="max-h-[60vh] space-y-1 overflow-y-auto">
            {isLoading && <p className="p-2 text-sm text-muted-foreground">Loading…</p>}
            {companies.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCompanyId(c.id)}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  companyId === c.id
                    ? "bg-[var(--bg-hover)] font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-[var(--bg-hover)]",
                )}
              >
                {c.name}
              </button>
            ))}
            {!isLoading && companies.length === 0 && (
              <p className="p-2 text-sm text-muted-foreground">No companies match.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          {!companyId ? (
            <p className="text-sm text-muted-foreground">
              Select a company to manage its features.
            </p>
          ) : (
            <>
              <h2 className="mb-5 text-lg font-semibold">{selected?.name}</h2>
              <FeatureTree companyId={companyId} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
