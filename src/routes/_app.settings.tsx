import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TRADES, type Trade } from "@/lib/trades";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TABS = ["Company", "Branding", "Defaults", "Trades", "Users", "Integrations"] as const;
type Tab = (typeof TABS)[number];

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
        {tab === "Defaults" && <Placeholder name="Defaults" />}
        {tab === "Trades" && <TradesTab />}
        {tab === "Users" && <Placeholder name="Users" />}
        {tab === "Integrations" && <Placeholder name="Integrations" />}
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
  useEffect(() => {
    if (company) {
      setName(company.name ?? "");
      setPhone(company.phone ?? "");
      setEmail(company.email ?? "");
      setAddress(company.address ?? "");
    }
  }, [company]);

  const save = useMutation({
    mutationFn: async () => {
      if (!company) return;
      const { error } = await supabase
        .from("companies")
        .update({ name, phone, email, address })
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
