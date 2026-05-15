import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { TRADES, type Trade } from "@/lib/trades";
import { STARTER_RULES } from "@/lib/starter-rules";
import { TradeBadge } from "@/components/brand/TradeBadge";
import { Plus, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MaterialsTemplatesTab } from "@/components/settings/MaterialsTemplatesTab";

const TABS = ["Company", "Branding", "Defaults", "Trades", "Rules", "Materials", "Users", "Integrations"] as const;
type Tab = (typeof TABS)[number];
const RULE_TYPES = ["required", "recommended", "conditional"] as const;
type RuleType = (typeof RULE_TYPES)[number];

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [tab, setTab] = useState<Tab>("Company");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your company, defaults, and team.
        </p>
      </div>

      <div className="flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === t
                ? "border-[var(--brand)] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div
        className="rounded-xl border p-6"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        {tab === "Company" && <CompanyTab />}
        {tab === "Branding" && <Placeholder name="Branding" />}
        {tab === "Defaults" && <DefaultsTab />}
        {tab === "Trades" && <TradesTab />}
        {tab === "Rules" && <RulesTab />}
        {tab === "Materials" && <MaterialsTemplatesTab />}
        {tab === "Users" && <Placeholder name="Users" />}
        {tab === "Integrations" && <Placeholder name="Integrations" />}
      </div>
    </div>
  );
}

function DefaultsTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: company } = useQuery({
    queryKey: ["company"],
    enabled: !!user,
    queryFn: async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user!.id)
        .maybeSingle();
      if (!prof?.company_id) return null;
      const { data } = await supabase.from("companies").select("*").eq("id", prof.company_id).maybeSingle();
      return data;
    },
  });

  const [autoAdd, setAutoAdd] = useState(false);
  useEffect(() => {
    if (company) setAutoAdd(Boolean(company.auto_add_photo_suggestions));
  }, [company]);

  const save = useMutation({
    mutationFn: async (next: boolean) => {
      if (!company) return;
      const { error } = await supabase
        .from("companies")
        .update({ auto_add_photo_suggestions: next })
        .eq("id", company.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Defaults updated");
      qc.invalidateQueries({ queryKey: ["company"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!company) return <p className="text-sm text-muted-foreground">No company on file.</p>;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Photo AI
        </h2>
        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-[var(--surface-hover)]" style={{ borderColor: "var(--border)" }}>
          <input
            type="checkbox"
            checked={autoAdd}
            onChange={(e) => {
              const next = e.target.checked;
              setAutoAdd(next);
              save.mutate(next);
            }}
            className="mt-0.5 h-4 w-4"
          />
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">
              Auto-add AI suggestions to estimate
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              When ON, line items detected from job photos are automatically inserted into the active estimate as drafts (marked with an ✨ AI chip). When OFF, suggestions appear in a review panel at the top of the estimate for you to approve.
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}

function Placeholder({ name }: { name: string }) {
  return <p className="text-sm text-muted-foreground">{name} settings coming in the next build.</p>;
}

function CompanyTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: company } = useQuery({
    queryKey: ["company"],
    enabled: !!user,
    queryFn: async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user!.id)
        .maybeSingle();
      if (!prof?.company_id) return null;
      const { data } = await supabase.from("companies").select("*").eq("id", prof.company_id).maybeSingle();
      return data;
    },
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  useEffect(() => {
    if (company) {
      setName(company.name ?? "");
      setPhone(company.phone ?? "");
      setEmail(company.email ?? "");
      setAddress(company.address ?? "");
      setWebsite(company.website ?? "");
      setLogoUrl(company.logo_url ?? "");
    }
  }, [company]);

  const save = useMutation({
    mutationFn: async () => {
      if (!company) return;
      const { error } = await supabase
        .from("companies")
        .update({ name, phone, email, address, website, logo_url: logoUrl })
        .eq("id", company.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Company saved");
      qc.invalidateQueries({ queryKey: ["company"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!company) return <p className="text-sm text-muted-foreground">No company on file.</p>;

  return (
    <div className="grid max-w-xl grid-cols-1 gap-4">
      <Field label="Company name" value={name} onChange={setName} />
      <Field label="Phone" value={phone} onChange={setPhone} />
      <Field label="Email" value={email} onChange={setEmail} type="email" />
      <Field label="Address" value={address} onChange={setAddress} />
      <Field label="Website" value={website} onChange={setWebsite} />
      <Field label="Logo URL" value={logoUrl} onChange={setLogoUrl} />
      {logoUrl && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Logo preview</div>
          <img src={logoUrl} alt="Logo" className="h-16 w-auto object-contain" />
        </div>
      )}
      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="btn-brand h-10 w-fit rounded-md px-6 text-sm font-semibold"
      >
        Save
      </button>
    </div>
  );
}

function TradesTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: company } = useQuery({
    queryKey: ["company"],
    enabled: !!user,
    queryFn: async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user!.id)
        .maybeSingle();
      if (!prof?.company_id) return null;
      const { data } = await supabase.from("companies").select("*").eq("id", prof.company_id).maybeSingle();
      return data;
    },
  });
  const [selected, setSelected] = useState<Trade[]>([]);
  useEffect(() => {
    if (company?.trades) setSelected(company.trades as Trade[]);
  }, [company]);

  const save = useMutation({
    mutationFn: async () => {
      if (!company) return;
      const { error } = await supabase
        .from("companies")
        .update({ trades: selected })
        .eq("id", company.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Trades updated");
      qc.invalidateQueries({ queryKey: ["company"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(t: Trade) {
    setSelected((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  if (!company) return <p className="text-sm text-muted-foreground">No company on file.</p>;

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Choose the trades your company performs. This affects dashboard filtering and AI scoping.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TRADES.map((t) => {
          const sel = selected.includes(t.value);
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => toggle(t.value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border p-3 text-xs font-medium transition-all",
                !sel && "text-muted-foreground hover:bg-[var(--surface-hover)]",
              )}
              style={
                sel
                  ? { backgroundColor: `${t.color}1f`, borderColor: `${t.color}80`, color: t.color }
                  : { borderColor: "var(--border)" }
              }
            >
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: t.color }} />
              {t.label}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="btn-brand mt-6 h-10 rounded-md px-6 text-sm font-semibold"
      >
        Save trades
      </button>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded-md border bg-[var(--surface-elevated)] px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
        style={{ borderColor: "var(--border)" }}
      />
    </div>
  );
}

/* ============ RULES TAB ============ */
type CompanionRule = {
  id: string;
  trigger_category: string;
  trigger_trade: Trade | null;
  suggested_codes: string[];
  rule_type: RuleType;
  jurisdiction: string | null;
  notes: string | null;
};

function RulesTab() {
  const { data: profile } = useProfile();
  const companyId = profile?.company_id ?? null;
  const isAdmin = profile?.role === "owner" || profile?.role === "admin" || profile?.role === "super_admin";
  const qc = useQueryClient();
  const [drawer, setDrawer] = useState<{ open: boolean; rule?: CompanionRule }>({ open: false });
  const [seeding, setSeeding] = useState(false);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["companion-rules", companyId],
    enabled: !!companyId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companion_rules")
        .select("id, trigger_category, trigger_trade, suggested_codes, rule_type, jurisdiction, notes")
        .order("trigger_trade")
        .order("trigger_category");
      if (error) throw error;
      return (data ?? []) as CompanionRule[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("companion_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rule deleted");
      qc.invalidateQueries({ queryKey: ["companion-rules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function loadStarterRules() {
    if (!companyId) return;
    setSeeding(true);
    try {
      const payload = STARTER_RULES.map((r) => ({
        company_id: companyId,
        trigger_category: r.trigger_category,
        trigger_trade: r.trigger_trade,
        suggested_codes: r.suggested_codes,
        rule_type: r.rule_type,
      }));
      const { error } = await supabase.from("companion_rules").insert(payload);
      if (error) throw error;
      toast.success(`Loaded ${payload.length} starter rules`);
      qc.invalidateQueries({ queryKey: ["companion-rules"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSeeding(false);
    }
  }

  if (!companyId) return <p className="text-sm text-muted-foreground">No company on file.</p>;
  if (!isAdmin) return <p className="text-sm text-muted-foreground">Only admins can manage companion rules.</p>;
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-[var(--surface-elevated)]" />
        ))}
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-base font-bold text-foreground">No companion rules yet</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Companion rules suggest related line items when an estimator picks a trigger category — e.g. when "shingles" is added, also suggest drip edge, starter, and underlayment.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            onClick={loadStarterRules}
            disabled={seeding}
            className="btn-brand h-9 rounded-md px-4 text-sm font-semibold disabled:opacity-50"
          >
            {seeding ? "Loading…" : `Load starter rules (${STARTER_RULES.length} rules across 8 trades)`}
          </button>
          <button
            onClick={() => setDrawer({ open: true })}
            className="h-9 rounded-md border px-4 text-sm font-semibold text-foreground hover:bg-[var(--surface-hover)]"
            style={{ borderColor: "var(--border)" }}
          >
            <Plus className="mr-1 inline h-3.5 w-3.5" />
            New Rule
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rules.length} rule{rules.length === 1 ? "" : "s"} active.
        </p>
        <button
          onClick={() => setDrawer({ open: true })}
          className="btn-chrome flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold"
        >
          <Plus className="h-3.5 w-3.5" /> New Rule
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Trigger</th>
              <th className="px-4 py-3 font-semibold">Suggested Codes</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Jurisdiction</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="group border-t hover:bg-[var(--surface-hover)]" style={{ borderColor: "var(--border)" }}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {r.trigger_trade && <TradeBadge trade={r.trigger_trade} />}
                    <span className="font-medium text-foreground">{r.trigger_category}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground line-clamp-2">
                  {r.suggested_codes.join(", ")}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
                    style={{
                      background: r.rule_type === "required" ? "rgba(239,68,68,.15)"
                        : r.rule_type === "recommended" ? "rgba(30,144,255,.15)"
                        : "rgba(168,85,247,.15)",
                      color: r.rule_type === "required" ? "#fca5a5"
                        : r.rule_type === "recommended" ? "#7dc3ff"
                        : "#c4a5f7",
                    }}
                  >
                    {r.rule_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.jurisdiction ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => setDrawer({ open: true, rule: r })}
                      className="rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-[var(--surface-elevated)] hover:text-foreground"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => del.mutate(r.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-[var(--surface-elevated)] hover:text-foreground"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drawer.open && (
        <RuleDrawer
          companyId={companyId}
          rule={drawer.rule}
          onClose={() => setDrawer({ open: false })}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["companion-rules"] });
            setDrawer({ open: false });
          }}
        />
      )}
    </div>
  );
}

function RuleDrawer({
  companyId, rule, onClose, onSaved,
}: {
  companyId: string;
  rule?: CompanionRule;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState(rule?.trigger_category ?? "");
  const [trade, setTrade] = useState<Trade>(rule?.trigger_trade ?? "roofing");
  const [codesInput, setCodesInput] = useState((rule?.suggested_codes ?? []).join(", "));
  const [type, setType] = useState<RuleType>(rule?.rule_type ?? "recommended");
  const [jurisdiction, setJurisdiction] = useState(rule?.jurisdiction ?? "");
  const [notes, setNotes] = useState(rule?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!category.trim()) {
      toast.error("Trigger category is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        company_id: companyId,
        trigger_category: category.trim(),
        trigger_trade: trade,
        suggested_codes: codesInput.split(",").map((s) => s.trim()).filter(Boolean),
        rule_type: type,
        jurisdiction: jurisdiction.trim() || null,
        notes: notes.trim() || null,
      };
      if (rule) {
        const { error } = await supabase.from("companion_rules").update(payload).eq("id", rule.id);
        if (error) throw error;
        toast.success("Rule updated");
      } else {
        const { error } = await supabase.from("companion_rules").insert(payload);
        if (error) throw error;
        toast.success("Rule created");
      }
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/50" onClick={onClose} />
      <div
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l shadow-2xl"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-lg font-bold text-foreground">{rule ? "Edit Rule" : "New Rule"}</h2>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <RField label="Trigger Category *">
            <input value={category} onChange={(e) => setCategory(e.target.value)} className="r-input" />
          </RField>
          <RField label="Trigger Trade">
            <select value={trade} onChange={(e) => setTrade(e.target.value as Trade)} className="r-input">
              {TRADES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </RField>
          <RField label="Suggested Codes (comma-separated)">
            <textarea value={codesInput} onChange={(e) => setCodesInput(e.target.value)} rows={3} className="r-input resize-none" />
          </RField>
          <RField label="Rule Type">
            <div className="flex gap-2">
              {RULE_TYPES.map((t) => (
                <button
                  key={t} type="button" onClick={() => setType(t)}
                  className={cn(
                    "h-9 flex-1 rounded-md border text-xs font-semibold capitalize",
                    type === t ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                  style={{
                    borderColor: type === t ? "var(--brand)" : "var(--border)",
                    background: type === t ? "color-mix(in oklab, var(--brand) 12%, transparent)" : "transparent",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </RField>
          <RField label="Jurisdiction (optional)">
            <input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className="r-input" />
          </RField>
          <RField label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="r-input resize-none" />
          </RField>
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={onClose}
            className="h-9 rounded-md border px-4 text-sm font-semibold text-foreground hover:bg-[var(--surface-hover)]"
            style={{ borderColor: "var(--border)" }}
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="btn-brand h-9 rounded-md px-4 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : rule ? "Save changes" : "Create"}
          </button>
        </div>
      </div>
      <style>{`
        .r-input {
          width: 100%; height: 36px; border-radius: 6px; padding: 0 10px;
          background: var(--surface-elevated); border: 1px solid var(--border);
          color: hsl(var(--foreground)); font-size: 13px;
        }
        textarea.r-input { height: auto; padding: 8px 10px; }
        .r-input:focus { outline: none; box-shadow: 0 0 0 1px var(--brand); }
      `}</style>
    </>
  );
}

function RField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
