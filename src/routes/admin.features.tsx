import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  applyFeaturePreset,
  loadCompanyGrants,
  loadFeatureAdmin,
  setCompanyFeature,
} from "@/lib/features-admin.functions";

export const Route = createFileRoute("/admin/features")({
  component: FeaturesAdmin,
});

function FeaturesAdmin() {
  const qc = useQueryClient();
  const load = useServerFn(loadFeatureAdmin);
  const loadGrants = useServerFn(loadCompanyGrants);
  const setFeature = useServerFn(setCompanyFeature);
  const applyPreset = useServerFn(applyFeaturePreset);

  const [search, setSearch] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["feature-admin"],
    queryFn: () => load(),
  });

  const { data: grants = [] } = useQuery({
    queryKey: ["feature-admin-grants", companyId],
    enabled: !!companyId,
    queryFn: () => loadGrants({ data: { companyId: companyId! } }),
  });

  const enabled = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const g of grants) m[g.feature_key] = g.enabled;
    return m;
  }, [grants]);

  const toggle = useMutation({
    mutationFn: (v: { featureKey: string; enabled: boolean }) =>
      setFeature({ data: { companyId: companyId!, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feature-admin-grants", companyId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const preset = useMutation({
    mutationFn: (presetId: string) => applyPreset({ data: { companyId: companyId!, presetId } }),
    onSuccess: () => {
      toast.success("Preset applied");
      qc.invalidateQueries({ queryKey: ["feature-admin-grants", companyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const companies = (data?.companies ?? []).filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase()),
  );
  const features = data?.features ?? [];
  const parents = features.filter((f) => !f.parent_key);
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
        {/* Company list */}
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

        {/* Feature tree */}
        <div className="rounded-2xl border border-border bg-card p-5">
          {!companyId ? (
            <p className="text-sm text-muted-foreground">
              Select a company to manage its features.
            </p>
          ) : (
            <>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{selected?.name}</h2>
                {(data?.presets.length ?? 0) > 0 && (
                  <div className="w-56">
                    <Select onValueChange={(v) => preset.mutate(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Apply preset…" />
                      </SelectTrigger>
                      <SelectContent>
                        {data!.presets.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {parents.map((p) => {
                  const parentOn = !!enabled[p.key];
                  const children = features.filter((f) => f.parent_key === p.key);
                  return (
                    <div key={p.key} className="rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold">{p.label}</p>
                          <p className="font-mono-num text-[11px] text-muted-foreground">
                            {p.key}
                          </p>
                        </div>
                        <Switch
                          checked={parentOn}
                          onCheckedChange={(v) =>
                            toggle.mutate({ featureKey: p.key, enabled: v })
                          }
                        />
                      </div>
                      {children.length > 0 && (
                        <div
                          className={cn(
                            "mt-3 space-y-2 border-l pl-4",
                            !parentOn && "opacity-40",
                          )}
                          style={{ borderColor: "var(--border)" }}
                        >
                          {children.map((c) => (
                            <div key={c.key} className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-sm">{c.label}</p>
                                <p className="font-mono-num text-[11px] text-muted-foreground">
                                  {c.key}
                                </p>
                              </div>
                              <Switch
                                checked={!!enabled[c.key]}
                                onCheckedChange={(v) =>
                                  toggle.mutate({ featureKey: c.key, enabled: v })
                                }
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
