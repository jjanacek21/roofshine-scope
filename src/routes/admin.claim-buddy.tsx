import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CbLineItemSearch } from "@/components/admin/CbLineItemSearch";
import { CbCompaniesTab, CbDemoRequestsTab, useCbUnhandledDemoCount } from "@/components/admin/CbCompaniesTab";
import { CbSiteTab } from "@/components/admin/CbSiteTab";
import {
  CB_QTY_MODES,
  CB_ROOF_SYSTEMS,
  catalogCoverage,
  cloneCatalogVersion,
  listCatalogVersions,
  loadAssemblies,
  loadAssemblyItems,
  loadItemMappings,
  loadLineItems,
  makeVersionCurrent,
  roofSystemLabel,
  type CbCatalogLineItem,
} from "@/lib/cbCatalogResolve";

export const Route = createFileRoute("/admin/claim-buddy")({
  ssr: false,
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/cb/login" });
    const { data: isSuper } = await supabase.rpc("cb_is_super_admin");
    if (!isSuper) throw redirect({ to: "/cb" });
  },
  head: () => ({
    meta: [
      { title: "Claim Buddy estimate catalog — Admin" },
      {
        name: "description",
        content:
          "Assemblies, item mappings, code rules and measurement accuracy for the Claim Buddy estimate engine.",
      },
      { property: "og:title", content: "Claim Buddy estimate catalog — Admin" },
      { property: "og:description", content: "Data-driven Claim Buddy estimating, versioned and auditable." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClaimBuddyAdmin,
});

const SCOPES: { scope: string; label: string }[] = [
  { scope: "roof", label: "Roof takeoff" },
  { scope: "exterior", label: "Exterior takeoff" },
  { scope: "interior", label: "Interior takeoff" },
];

function ClaimBuddyAdmin() {
  const qc = useQueryClient();
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["cb-catalog-versions"],
    queryFn: listCatalogVersions,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const version = versions.find((v) => v.id === selected) ?? versions.find((v) => v.is_current) ?? versions[0] ?? null;
  const editable = !!version && !version.is_current;

  const clone = useMutation({
    mutationFn: async () => {
      if (!version) throw new Error("No version");
      return cloneCatalogVersion(version.id, `Draft from ${new Date().toLocaleString()}`);
    },
    onSuccess: (id) => {
      setSelected(id);
      void qc.invalidateQueries({ queryKey: ["cb-catalog-versions"] });
      toast.success("Draft created — edits apply to the draft only");
    },
    onError: () => toast.error("Couldn't create the draft"),
  });

  const publish = useMutation({
    mutationFn: async () => {
      if (!version) throw new Error("No version");
      await makeVersionCurrent(version.id, version.company_id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cb-catalog-versions"] });
      toast.success("Published — new estimates use this version");
    },
    onError: () => toast.error("Couldn't publish"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading the catalog…
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Claim Buddy estimate catalog</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estimates are produced from this data — base assembly by roof system, mappings from what the rep
          checked, then code rules. Nothing is inferred from the name of a roof.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <span className="text-sm font-medium">Version</span>
        <Select value={version?.id ?? ""} onValueChange={setSelected}>
          <SelectTrigger className="w-[380px]">
            <SelectValue placeholder="Pick a version" />
          </SelectTrigger>
          <SelectContent>
            {versions.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.is_current ? "Published · " : "Draft · "}
                {v.note ?? v.id.slice(0, 8)} — {new Date(v.created_at).toLocaleDateString()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {version?.is_current ? <Badge>Published — read only</Badge> : <Badge variant="secondary">Draft</Badge>}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => clone.mutate()} disabled={!version || clone.isPending}>
            New draft from this version
          </Button>
          <Button onClick={() => publish.mutate()} disabled={!version || version.is_current || publish.isPending}>
            Publish draft
          </Button>
        </div>
        <p className="w-full text-xs text-muted-foreground">
          Published versions are never edited in place — estimates stamped with a version keep resolving
          exactly as they were signed.
        </p>
      </div>

      <Tabs defaultValue={version ? "roof" : "companies"}>
        <TabsList className="flex-wrap">
          {version
            ? SCOPES.map((s) => (
                <TabsTrigger key={s.scope} value={s.scope}>
                  {s.label}
                </TabsTrigger>
              ))
            : null}
          {version ? <TabsTrigger value="assemblies">Assemblies</TabsTrigger> : null}
          {version ? <TabsTrigger value="code">Code rules</TabsTrigger> : null}
          {version ? <TabsTrigger value="accuracy">Measurement accuracy</TabsTrigger> : null}
          <TabsTrigger value="companies">Companies &amp; users</TabsTrigger>
          <TabsTrigger value="site">Marketing site</TabsTrigger>
          <TabsTrigger value="demos">
            Demo requests
            <DemoBadge />
          </TabsTrigger>
        </TabsList>

        {version ? (
          <>
            {SCOPES.map((s) => (
              <TabsContent key={s.scope} value={s.scope} className="mt-4">
                <MappingsTab versionId={version.id} scope={s.scope} editable={editable} />
              </TabsContent>
            ))}

            <TabsContent value="assemblies" className="mt-4">
              <AssembliesTab versionId={version.id} editable={editable} />
            </TabsContent>
            <TabsContent value="code" className="mt-4">
              <CodeRulesTab editable />
            </TabsContent>
            <TabsContent value="accuracy" className="mt-4">
              <AccuracyTab />
            </TabsContent>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No catalog version exists yet.</p>
        )}

        <TabsContent value="companies" className="mt-4">
          <CbCompaniesTab />
        </TabsContent>
        <TabsContent value="site" className="mt-4">
          <CbSiteTab />
        </TabsContent>
        <TabsContent value="demos" className="mt-4">
          <CbDemoRequestsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* mappings                                                            */
/* ------------------------------------------------------------------ */

function QtyModeSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-[230px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CB_QTY_MODES.map((m) => (
          <SelectItem key={m.value} value={m.value}>
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MappingsTab({
  versionId,
  scope,
  editable,
}: {
  versionId: string;
  scope: string;
  editable: boolean;
}) {
  const qc = useQueryClient();
  const [active, setActive] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [systemFilter, setSystemFilter] = useState<string>("all");

  const { data: catalog = [] } = useQuery({
    queryKey: ["cb-admin-catalog", scope],
    queryFn: async () => {
      const { data } = await supabase
        .from("cb_item_catalog")
        .select("id, item_key, label, unit, group_name, sort_order")
        .eq("scope", scope)
        .eq("active", true)
        .order("sort_order");
      return data ?? [];
    },
  });

  const { data: mappings = [] } = useQuery({
    queryKey: ["cb-mappings", versionId],
    queryFn: () => loadItemMappings(versionId),
  });

  const { data: masters } = useQuery({
    queryKey: ["cb-mapping-line-items", versionId, mappings.length],
    queryFn: () => loadLineItems(mappings.map((m) => m.line_item_id).filter(Boolean) as string[]),
    enabled: mappings.length > 0,
  });

  const { data: coverage = [] } = useQuery({
    queryKey: ["cb-coverage", versionId, systemFilter],
    queryFn: () => catalogCoverage(versionId, systemFilter === "all" ? null : systemFilter),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["cb-mappings", versionId] });
    void qc.invalidateQueries({ queryKey: ["cb-coverage", versionId] });
  };

  const addMapping = useMutation({
    mutationFn: async (item: CbCatalogLineItem) => {
      if (!active) return;
      const { error } = await supabase.from("cb_item_mappings").insert({
        version_id: versionId,
        catalog_item_id: active,
        line_item_id: item.id,
        qty_mode: "per_ea",
        qty_factor: 1,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Couldn't add the mapping"),
  });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TablesUpdate<"cb_item_mappings"> }) => {
      const { error } = await supabase.from("cb_item_mappings").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Couldn't save"),
  });

  /* Mappings are deprecated, never deleted, so historical estimates resolve. */
  const deprecate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cb_item_mappings").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const scopeCoverage = coverage.find((c) => c.scope === scope);
  const rowsForItem = mappings.filter((m) => m.catalog_item_id === active && m.is_active);
  const activeItem = catalog.find((c) => c.id === active);

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border p-3">
          <span className="text-sm font-medium">
            {scopeCoverage
              ? `${scopeCoverage.mapped}/${scopeCoverage.total} mapped (${Math.round(
                  (scopeCoverage.mapped / Math.max(1, scopeCoverage.total)) * 100,
                )}%)`
              : "Coverage"}
          </span>
          <Select value={systemFilter} onValueChange={setSystemFilter}>
            <SelectTrigger className="w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roof systems</SelectItem>
              {CB_ROOF_SYSTEMS.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto">
          {catalog.map((c) => {
            const count = mappings.filter((m) => m.catalog_item_id === c.id && m.is_active).length;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent ${
                    active === c.id ? "bg-accent" : ""
                  }`}
                  onClick={() => setActive(c.id)}
                >
                  <span>
                    {c.label}
                    <span className="ml-2 text-xs text-muted-foreground">{c.group_name}</span>
                  </span>
                  {count ? (
                    <Badge variant="secondary">{count}</Badge>
                  ) : (
                    <Badge variant="destructive">none</Badge>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        {!activeItem ? (
          <p className="text-sm text-muted-foreground">
            Pick a checklist item on the left to assign the price book lines it produces.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{activeItem.label}</h2>
                <p className="text-xs text-muted-foreground">
                  Unit {activeItem.unit ?? "EA"} · a row without a roof system is the default; a row with one
                  overrides it for that system only.
                </p>
              </div>
              <Button size="sm" disabled={!editable} onClick={() => setPicking(true)}>
                <Plus className="mr-1 h-4 w-4" /> Add line item
              </Button>
            </div>

            {!editable ? (
              <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                This version is published. Create a draft to make changes.
              </p>
            ) : null}

            <div className="mt-4 space-y-3">
              {rowsForItem.length === 0 ? (
                <p className="text-sm text-muted-foreground">No mapping yet — this item produces no lines.</p>
              ) : (
                rowsForItem.map((m) => {
                  const master = m.line_item_id ? masters?.get(m.line_item_id) : undefined;
                  return (
                    <div key={m.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{master?.name ?? "Line item removed"}</p>
                          <p className="text-xs text-muted-foreground">
                            {master?.code ?? "—"} · {master?.unit ?? "EA"} · $
                            {Number(master?.default_price ?? 0).toFixed(2)}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={!editable}
                          aria-label="Deprecate mapping"
                          onClick={() => deprecate.mutate(m.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <QtyModeSelect
                          value={m.qty_mode}
                          disabled={!editable}
                          onChange={(v) => patch.mutate({ id: m.id, values: { qty_mode: v } })}
                        />
                        <Input
                          className="w-24"
                          type="number"
                          step="0.01"
                          disabled={!editable}
                          defaultValue={m.qty_factor}
                          aria-label="Quantity factor"
                          onBlur={(e) =>
                            patch.mutate({ id: m.id, values: { qty_factor: Number(e.target.value) || 0 } })
                          }
                        />
                        <Input
                          className="w-24"
                          type="number"
                          step="1"
                          disabled={!editable}
                          defaultValue={m.waste_pct}
                          aria-label="Waste percent"
                          onBlur={(e) =>
                            patch.mutate({ id: m.id, values: { waste_pct: Number(e.target.value) || 0 } })
                          }
                        />
                        <Select
                          value={m.roof_system ?? "default"}
                          disabled={!editable}
                          onValueChange={(v) =>
                            patch.mutate({
                              id: m.id,
                              values: { roof_system: v === "default" ? null : v },
                            })
                          }
                        >
                          <SelectTrigger className="w-[210px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Every roof system (default)</SelectItem>
                            {CB_ROOF_SYSTEMS.map((s) => (
                              <SelectItem key={s.key} value={s.key}>
                                Override — {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          className="min-w-[200px] flex-1"
                          placeholder="Note"
                          disabled={!editable}
                          defaultValue={m.note ?? ""}
                          aria-label="Note"
                          onBlur={(e) => patch.mutate({ id: m.id, values: { note: e.target.value || null } })}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      <CbLineItemSearch open={picking} onOpenChange={setPicking} onPick={(item) => addMapping.mutate(item)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* assemblies                                                          */
/* ------------------------------------------------------------------ */

function AssembliesTab({ versionId, editable }: { versionId: string; editable: boolean }) {
  const qc = useQueryClient();
  const [system, setSystem] = useState(CB_ROOF_SYSTEMS[1].key);
  const [picking, setPicking] = useState(false);

  const { data: assemblies = [] } = useQuery({
    queryKey: ["cb-assemblies", versionId],
    queryFn: () => loadAssemblies(versionId),
  });
  const assembly = assemblies.find((a) => a.roof_system === system) ?? null;

  const { data: items = [] } = useQuery({
    queryKey: ["cb-assembly-items", assembly?.id],
    queryFn: () => loadAssemblyItems(assembly ? [assembly.id] : []),
    enabled: !!assembly,
  });

  const { data: masters } = useQuery({
    queryKey: ["cb-assembly-line-items", assembly?.id, items.length],
    queryFn: () => loadLineItems(items.map((i) => i.line_item_id).filter(Boolean) as string[]),
    enabled: items.length > 0,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["cb-assembly-items", assembly?.id] });
  };

  const add = useMutation({
    mutationFn: async (item: CbCatalogLineItem) => {
      if (!assembly) throw new Error("No assembly");
      const { error } = await supabase.from("cb_assembly_items").insert({
        assembly_id: assembly.id,
        line_item_id: item.id,
        qty_mode: "per_square",
        qty_factor: 1,
        sort_order: (items.at(-1)?.sort_order ?? 0) + 10,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Couldn't add the line"),
  });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TablesUpdate<"cb_assembly_items"> }) => {
      const { error } = await supabase.from("cb_assembly_items").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Couldn't save"),
  });

  const active = items.filter((i) => i.is_active);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={system} onValueChange={setSystem}>
          <SelectTrigger className="w-[280px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CB_ROOF_SYSTEMS.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant={active.length ? "secondary" : "destructive"}>{active.length} lines</Badge>
        <Button size="sm" disabled={!editable || !assembly} onClick={() => setPicking(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add line item
        </Button>
      </div>

      {!assembly ? (
        <p className="text-sm text-muted-foreground">
          No assembly row exists for {roofSystemLabel(system)} in this version.
        </p>
      ) : (
        <div className="space-y-3">
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Empty — an estimate for this system will fail loudly rather than borrow another system's scope.
            </p>
          ) : (
            active.map((i) => {
              const master = i.line_item_id ? masters?.get(i.line_item_id) : undefined;
              return (
                <div key={i.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{master?.name ?? "Line item removed"}</p>
                      <p className="text-xs text-muted-foreground">
                        {master?.code ?? "—"} · {master?.unit ?? "EA"} · {i.role ?? "line"}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={!editable}
                      aria-label="Deprecate line"
                      onClick={() => patch.mutate({ id: i.id, values: { is_active: false } })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <QtyModeSelect
                      value={i.qty_mode}
                      disabled={!editable}
                      onChange={(v) => patch.mutate({ id: i.id, values: { qty_mode: v } })}
                    />
                    <Input
                      className="w-24"
                      type="number"
                      step="0.01"
                      disabled={!editable}
                      defaultValue={i.qty_factor}
                      aria-label="Quantity factor"
                      onBlur={(e) => patch.mutate({ id: i.id, values: { qty_factor: Number(e.target.value) || 0 } })}
                    />
                    <Input
                      className="w-24"
                      type="number"
                      disabled={!editable}
                      defaultValue={i.waste_pct}
                      aria-label="Waste percent"
                      onBlur={(e) => patch.mutate({ id: i.id, values: { waste_pct: Number(e.target.value) || 0 } })}
                    />
                    <Input
                      className="w-40"
                      placeholder="Role (tear_off, field…)"
                      disabled={!editable}
                      defaultValue={i.role ?? ""}
                      aria-label="Role"
                      onBlur={(e) => patch.mutate({ id: i.id, values: { role: e.target.value || null } })}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <CbLineItemSearch open={picking} onOpenChange={setPicking} onPick={(item) => add.mutate(item)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* code rules                                                          */
/* ------------------------------------------------------------------ */

function CodeRulesTab({ editable }: { editable: boolean }) {
  const qc = useQueryClient();
  const [activeSet, setActiveSet] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const { data: sets = [] } = useQuery({
    queryKey: ["cb-code-sets"],
    queryFn: async () => {
      const { data } = await supabase.from("code_rule_sets").select("*").order("state");
      return data ?? [];
    },
  });
  const { data: items = [] } = useQuery({
    queryKey: ["cb-code-items", activeSet],
    queryFn: async () => {
      const { data } = await supabase
        .from("code_rule_items")
        .select("*")
        .eq("rule_set_id", activeSet!)
        .order("sort_order");
      return data ?? [];
    },
    enabled: !!activeSet,
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["cb-code-items", activeSet] });

  const add = useMutation({
    mutationFn: async (item: CbCatalogLineItem) => {
      if (!activeSet) return;
      const { error } = await supabase.from("code_rule_items").insert({
        rule_set_id: activeSet,
        line_item_id: item.id,
        item_name: item.name,
        unit: item.unit,
        qty_mode: "per_square",
        qty_factor: 1,
        code_reference: "",
        sort_order: items.length * 10,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Couldn't add the code item"),
  });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TablesUpdate<"code_rule_items"> }) => {
      const { error } = await supabase.from("code_rule_items").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("code_rule_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="rounded-xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {sets.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-sm hover:bg-accent ${activeSet === s.id ? "bg-accent" : ""}`}
                onClick={() => setActiveSet(s.id)}
              >
                <span className="font-medium">{s.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {s.state}
                  {s.county ? ` · ${s.county}` : " · statewide"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        {!activeSet ? (
          <p className="text-sm text-muted-foreground">Pick a rule set.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{sets.find((s) => s.id === activeSet)?.name}</h2>
              <Button size="sm" disabled={!editable} onClick={() => setPicking(true)}>
                <Plus className="mr-1 h-4 w-4" /> Add code item
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Code items are entered from real carrier estimates only. An empty rule set is correct until the
              real items are supplied — nothing is invented here.
            </p>
            <div className="mt-4 space-y-3">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Empty — no code items entered for this jurisdiction.</p>
              ) : (
                items.map((i) => (
                  <div key={i.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">{i.item_name}</p>
                      <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => remove.mutate(i.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Input
                        className="w-52"
                        placeholder="Code reference"
                        defaultValue={i.code_reference ?? ""}
                        aria-label="Code reference"
                        onBlur={(e) => patch.mutate({ id: i.id, values: { code_reference: e.target.value } })}
                      />
                      <Input
                        className="w-40"
                        placeholder="Qty mode"
                        defaultValue={i.qty_mode ?? ""}
                        aria-label="Quantity mode"
                        onBlur={(e) => patch.mutate({ id: i.id, values: { qty_mode: e.target.value } })}
                      />
                      <Input
                        className="w-24"
                        type="number"
                        step="0.01"
                        defaultValue={i.qty_factor ?? 1}
                        aria-label="Quantity factor"
                        onBlur={(e) => patch.mutate({ id: i.id, values: { qty_factor: Number(e.target.value) || 0 } })}
                      />
                      <Input
                        className="w-56"
                        placeholder="Applies to roof system (blank = all)"
                        defaultValue={i.applies_to_roof_system ?? ""}
                        aria-label="Applies to roof system"
                        onBlur={(e) =>
                          patch.mutate({ id: i.id, values: { applies_to_roof_system: e.target.value || null } })
                        }
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <CbLineItemSearch open={picking} onOpenChange={setPicking} onPick={(item) => add.mutate(item)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* measurement accuracy                                                */
/* ------------------------------------------------------------------ */

function AccuracyTab() {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["cb-measurement-accuracy"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_measurement_runs")
        .select(
          "id, provider, roof_system, area_delta_pct, perimeter_delta_pct, avg_vertex_shift_ft, max_vertex_shift_ft, rep_overrode, address, created_at, regularized_geometry",
        )
        .order("created_at", { ascending: false })
        .limit(1000);
      return data ?? [];
    },
  });

  const byProvider = useMemo(() => group(runs, (r) => r.provider ?? "unknown"), [runs]);
  const bySystem = useMemo(() => group(runs, (r) => r.roof_system ?? "not recorded"), [runs]);
  const regularized = useMemo(() => {
    const withReg = runs.filter((r) => r.regularized_geometry);
    const without = runs.filter((r) => !r.regularized_geometry);
    return {
      withReg: avg(withReg.map((r) => Math.abs(Number(r.area_delta_pct ?? 0)))),
      without: avg(without.map((r) => Math.abs(Number(r.area_delta_pct ?? 0)))),
      withCount: withReg.length,
      withoutCount: without.length,
    };
  }, [runs]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading runs…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Ground truth is the rep's own correction — engine output versus the geometry the rep saved after
        dragging corners. {runs.length} runs recorded.
      </p>

      <AccuracyTable title="By provider" rows={byProvider} />
      <AccuracyTable title="By roof system" rows={bySystem} />

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Is the squaring pass helping?</h3>
        <p className="mt-2 text-sm">
          Average area correction with regularization:{" "}
          <strong>{regularized.withReg.toFixed(2)}%</strong> across {regularized.withCount} runs · without:{" "}
          <strong>{regularized.without.toFixed(2)}%</strong> across {regularized.withoutCount} runs.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          A lower number with regularization means reps are dragging corners less.
        </p>
      </div>
    </div>
  );
}

type RunRow = {
  provider: string | null;
  roof_system: string | null;
  area_delta_pct: number | null;
  perimeter_delta_pct: number | null;
  avg_vertex_shift_ft: number | null;
  rep_overrode: boolean | null;
};

function group(runs: RunRow[], key: (r: RunRow) => string) {
  const map = new Map<string, RunRow[]>();
  for (const r of runs) {
    const k = key(r);
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return Array.from(map.entries()).map(([label, rows]) => ({
    label,
    count: rows.length,
    area: avg(rows.map((r) => Math.abs(Number(r.area_delta_pct ?? 0)))),
    perimeter: avg(rows.map((r) => Math.abs(Number(r.perimeter_delta_pct ?? 0)))),
    vertex: avg(rows.map((r) => Math.abs(Number(r.avg_vertex_shift_ft ?? 0)))),
    overrides: rows.filter((r) => r.rep_overrode).length,
  }));
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function AccuracyTable({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number; area: number; perimeter: number; vertex: number; overrides: number }[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <h3 className="border-b border-border p-3 text-sm font-semibold">{title}</h3>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="p-3 text-left">Name</th>
            <th className="p-3 text-right">Runs</th>
            <th className="p-3 text-right">Avg area delta</th>
            <th className="p-3 text-right">Avg perimeter delta</th>
            <th className="p-3 text-right">Avg vertex move</th>
            <th className="p-3 text-right">Hard overrides</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="p-3 text-muted-foreground" colSpan={6}>
                No runs recorded yet.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.label} className="border-t border-border">
                <td className="p-3">{r.label}</td>
                <td className="p-3 text-right">{r.count}</td>
                <td className="p-3 text-right">{r.area.toFixed(2)}%</td>
                <td className="p-3 text-right">{r.perimeter.toFixed(2)}%</td>
                <td className="p-3 text-right">{r.vertex.toFixed(2)} ft</td>
                <td className="p-3 text-right">{r.overrides}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DemoBadge() {
  const { data = 0 } = useCbUnhandledDemoCount();
  if (!data) return null;
  return (
    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
      {data}
    </span>
  );
}
