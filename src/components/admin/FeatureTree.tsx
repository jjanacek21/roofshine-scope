import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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

/**
 * Per-company feature grant tree. Shared by the super-admin Features screen and
 * the Features tab inside a company's detail view — one implementation only.
 */
export function FeatureTree({
  companyId,
  showPresets = true,
}: {
  companyId: string;
  showPresets?: boolean;
}) {
  const qc = useQueryClient();
  const load = useServerFn(loadFeatureAdmin);
  const loadGrants = useServerFn(loadCompanyGrants);
  const setFeature = useServerFn(setCompanyFeature);
  const applyPreset = useServerFn(applyFeaturePreset);

  const { data } = useQuery({ queryKey: ["feature-admin"], queryFn: () => load() });

  const { data: grants = [] } = useQuery({
    queryKey: ["feature-admin-grants", companyId],
    enabled: !!companyId,
    queryFn: () => loadGrants({ data: { companyId } }),
  });

  const enabled = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const g of grants) m[g.feature_key] = g.enabled;
    return m;
  }, [grants]);

  const toggle = useMutation({
    mutationFn: (v: { featureKey: string; enabled: boolean }) =>
      setFeature({ data: { companyId, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feature-admin-grants", companyId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const preset = useMutation({
    mutationFn: (presetId: string) => applyPreset({ data: { companyId, presetId } }),
    onSuccess: () => {
      toast.success("Preset applied");
      qc.invalidateQueries({ queryKey: ["feature-admin-grants", companyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const features = data?.features ?? [];
  const parents = features.filter((f) => !f.parent_key);

  return (
    <div className="space-y-4">
      {showPresets && (data?.presets.length ?? 0) > 0 && (
        <div className="flex justify-end">
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
        </div>
      )}

      {parents.map((p) => {
        const parentOn = !!enabled[p.key];
        const children = features.filter((f) => f.parent_key === p.key);
        return (
          <div key={p.key} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">{p.label}</p>
                <p className="font-mono-num text-[11px] text-muted-foreground">{p.key}</p>
              </div>
              <Switch
                checked={parentOn}
                onCheckedChange={(v) => toggle.mutate({ featureKey: p.key, enabled: v })}
              />
            </div>
            {children.length > 0 && (
              <div
                className={cn("mt-3 space-y-2 border-l pl-4", !parentOn && "opacity-40")}
                style={{ borderColor: "var(--border)" }}
              >
                {children.map((c) => (
                  <div key={c.key} className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm">{c.label}</p>
                      <p className="font-mono-num text-[11px] text-muted-foreground">{c.key}</p>
                    </div>
                    <Switch
                      checked={!!enabled[c.key]}
                      onCheckedChange={(v) => toggle.mutate({ featureKey: c.key, enabled: v })}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
