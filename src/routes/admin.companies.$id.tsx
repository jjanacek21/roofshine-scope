import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { listMarkets } from "@/lib/markets.functions";
import {
  legalForState,
  US_STATES,
  type ContractProfile,
} from "@/lib/state-contract-law";
import {
  ArrowLeft,
  Copy,
  Send,
  Trash2,
  ExternalLink,
  Upload,
  FileText,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { CompanyLogoUploader } from "@/components/settings/CompanyLogoUploader";

export const Route = createFileRoute("/admin/companies/$id")({
  component: AdminCompanyDetail,
});

type Company = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  website: string | null;
  logo_url: string | null;
  created_at: string;
  default_market_id: string | null;
  contract_profile: ContractProfile | null;
  feature_door_to_door: boolean;
  feature_storm_intel: boolean;
  feature_roof_king: boolean;
  license_numbers: string[] | null;
};

type Rep = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string;
  card_slug: string | null;
  onboarding_completed_at: string | null;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  token: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
};

type Doc = {
  id: string;
  name: string;
  category: string;
  file_url: string | null;
  notes: string | null;
  created_at: string;
};

const ROLES = ["owner", "admin", "estimator", "member"] as const;
const TABS = ["Business info", "Features", "Pricing", "Contracts", "Documents", "Team"] as const;
type Tab = (typeof TABS)[number];

function AdminCompanyDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("Business info");
  const [company, setCompany] = useState<Company | null>(null);
  const [reps, setReps] = useState<Rep[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("member");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchMarkets = useServerFn(listMarkets);
  const marketsQuery = useQuery({
    queryKey: ["admin-markets"],
    queryFn: () => fetchMarkets(),
  });
  const markets = marketsQuery.data?.markets ?? [];

  const load = async () => {
    setLoading(true);
    const [{ data: co }, { data: ps }, { data: invs }, { data: dcs }] = await Promise.all([
      supabase.from("companies").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("profiles")
        .select("id, email, first_name, last_name, role, card_slug, onboarding_completed_at")
        .eq("company_id", id),
      supabase
        .from("company_invites")
        .select("id, email, role, token, accepted_at, expires_at, created_at")
        .eq("company_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("company_documents")
        .select("id, name, category, file_url, notes, created_at")
        .eq("company_id", id)
        .order("created_at", { ascending: false }),
    ]);
    setCompany(co as Company | null);
    setReps((ps as Rep[]) ?? []);
    setInvites((invs as Invite[]) ?? []);
    setDocs((dcs as Doc[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function patch(values: Partial<Company>) {
    if (!company) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("companies").update(values as any).eq("id", company.id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    setCompany({ ...company, ...values });
    return true;
  }

  const inviteLink = (token: string) => `${window.location.origin}/onboarding?invite=${token}`;

  async function sendInvite(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { data, error } = await supabase.rpc("create_company_invite_as_super_admin", {
      _company_id: id,
      _email: email.trim().toLowerCase(),
      _role: role,
    });
    if (error || !data) {
      toast.error(error?.message ?? "Could not create invite");
      setSubmitting(false);
      return;
    }
    const { token } = data as { token: string };
    try {
      await supabase.functions.invoke("send-invite-email", {
        body: {
          email: email.trim().toLowerCase(),
          inviteUrl: inviteLink(token),
          companyName: company?.name,
        },
      });
    } catch {
      // ignore — link is copied below
    }
    navigator.clipboard?.writeText(inviteLink(token)).catch(() => {});
    toast.success("Invite created and link copied");
    setEmail("");
    setSubmitting(false);
    load();
  }

  async function removeInvite(invId: string) {
    const { error } = await supabase.from("company_invites").delete().eq("id", invId);
    if (error) return toast.error(error.message);
    setInvites((r) => r.filter((i) => i.id !== invId));
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!company) {
    return (
      <div className="text-sm text-muted-foreground">
        Company not found.{" "}
        <Link to="/admin/companies" className="text-primary hover:underline">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/admin/companies"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> All companies
        </Link>
        <div className="mt-2 flex items-center gap-3">
          {company.logo_url && (
            <img
              src={company.logo_url}
              alt={`${company.name} logo`}
              className="h-10 w-10 rounded-md object-contain"
            />
          )}
          <div>
            <h1 className="text-2xl font-semibold">{company.name}</h1>
            <p className="text-sm text-muted-foreground">
              {company.email ?? "—"} {company.phone ? ` · ${company.phone}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Business info" && (
        <BusinessInfoTab company={company} userId={user?.id ?? null} onSave={patch} />
      )}
      {tab === "Features" && <FeaturesTab company={company} onSave={patch} />}
      {tab === "Pricing" && (
        <PricingTab
          company={company}
          markets={markets}
          loadingMarkets={marketsQuery.isLoading}
          onSave={patch}
        />
      )}
      {tab === "Contracts" && <ContractsTab company={company} onSave={patch} />}
      {tab === "Documents" && (
        <DocumentsTab companyId={company.id} docs={docs} reload={load} />
      )}
      {tab === "Team" && (
        <TeamTab
          reps={reps}
          invites={invites}
          email={email}
          setEmail={setEmail}
          role={role}
          setRole={setRole}
          submitting={submitting}
          sendInvite={sendInvite}
          removeInvite={removeInvite}
          inviteLink={inviteLink}
        />
      )}
    </div>
  );
}

/* ------------------------------- Business ------------------------------- */

function BusinessInfoTab({
  company,
  userId,
  onSave,
}: {
  company: Company;
  userId: string | null;
  onSave: (v: Partial<Company>) => Promise<boolean | undefined>;
}) {
  const [form, setForm] = useState({
    name: company.name ?? "",
    email: company.email ?? "",
    phone: company.phone ?? "",
    website: company.website ?? "",
    address: company.address ?? "",
    city: company.city ?? "",
    state: company.state ?? "",
    postal_code: company.postal_code ?? "",
    logo_url: company.logo_url ?? "",
    license_numbers: (company.license_numbers ?? []).join(", "),
  });
  const [saving, setSaving] = useState(false);
  

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const ok = await onSave({
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      website: form.website.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      postal_code: form.postal_code.trim() || null,
      logo_url: form.logo_url.trim() || null,
      license_numbers: form.license_numbers
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setSaving(false);
    if (ok) toast.success("Company info saved");
  }




  return (
    <form onSubmit={save} className="space-y-5 rounded-xl border border-border bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name">
          <input
            className="field-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </Field>
        <Field label="Website">
          <input
            className="field-input"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
          />
        </Field>
        <Field label="Email">
          <input
            className="field-input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <input
            className="field-input"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field label="Street address">
          <input
            className="field-input"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </Field>
        <Field label="City">
          <input
            className="field-input"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </Field>
        <Field label="State">
          <select
            className="field-input"
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
          >
            <option value="">— Select —</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ZIP">
          <input
            className="field-input"
            value={form.postal_code}
            onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
          />
        </Field>
        <Field label="License numbers (comma separated)">
          <input
            className="field-input"
            value={form.license_numbers}
            onChange={(e) => setForm({ ...form, license_numbers: e.target.value })}
          />
        </Field>
      </div>

      <CompanyLogoUploader
        companyId={company.id}
        userId={userId}
        value={form.logo_url || null}
        onChange={async (url) => {
          setForm((f) => ({ ...f, logo_url: url ?? "" }));
          await onSave({ logo_url: url });
          toast.success(url ? "Logo saved" : "Logo removed");
        }}
      />


      <button
        type="submit"
        disabled={saving}
        className="btn-brand h-10 rounded-md px-4 text-sm font-semibold disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save company info"}
      </button>
    </form>
  );
}

/* ------------------------------- Features ------------------------------- */

const FEATURES = [
  {
    key: "feature_door_to_door" as const,
    label: "Door to Door World",
    desc: "Canvassing map, dispositions, gamification and the D2D feed.",
  },
  {
    key: "feature_storm_intel" as const,
    label: "Storm Intelligence",
    desc: "Nationwide hail/wind swaths, point intelligence and storm mailers.",
  },
  {
    key: "feature_roof_king" as const,
    label: "Roof King",
    desc: "Service-ticket CRM, SPF calculator and Roof King branded workspace.",
  },
];

function FeaturesTab({
  company,
  onSave,
}: {
  company: Company;
  onSave: (v: Partial<Company>) => Promise<boolean | undefined>;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(key: (typeof FEATURES)[number]["key"], value: boolean) {
    setBusy(key);
    const patch: Partial<Company> = { [key]: value } as Partial<Company>;
    // Keep the legacy Roof King flag in sync so branding stays consistent.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (key === "feature_roof_king") (patch as any).is_roof_king = value;
    const ok = await onSave(patch);
    setBusy(null);
    if (ok) toast.success(`${value ? "Enabled" : "Disabled"} for ${company.name}`);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Features are off by default for every company. Turn on only what this company has
        purchased — their reps won't see the section in the sidebar until you do.
      </p>
      {FEATURES.map((f) => {
        const on = !!company[f.key];
        return (
          <div
            key={f.key}
            className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4"
          >
            <div>
              <div className="text-sm font-semibold">{f.label}</div>
              <div className="text-xs text-muted-foreground">{f.desc}</div>
            </div>
            <button
              type="button"
              disabled={busy === f.key}
              onClick={() => toggle(f.key, !on)}
              aria-pressed={on}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                on ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  on ? "left-6" : "left-1"
                }`}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------- Pricing ------------------------------- */

function PricingTab({
  company,
  markets,
  loadingMarkets,
  onSave,
}: {
  company: Company;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  markets: any[];
  loadingMarkets: boolean;
  onSave: (v: Partial<Company>) => Promise<boolean | undefined>;
}) {
  const [saving, setSaving] = useState(false);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold">Default price list (market)</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Used as the baseline for estimates when no company-specific book matches the job.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <select
          value={company.default_market_id ?? ""}
          onChange={async (e) => {
            setSaving(true);
            const ok = await onSave({ default_market_id: e.target.value || null });
            setSaving(false);
            if (ok) toast.success("Default market updated");
          }}
          disabled={saving || loadingMarkets}
          className="h-10 min-w-[280px] rounded-md border border-border bg-background px-3 text-sm disabled:opacity-60"
        >
          <option value="">— None —</option>
          {markets.map((m) => (
            <option key={m.id} value={m.id}>
              {m.region_name || m.name}
              {typeof m.item_count === "number" ? ` (${m.item_count} items)` : ""}
            </option>
          ))}
        </select>
        {saving && <span className="text-xs text-muted-foreground">Saving…</span>}
      </div>
    </section>
  );
}

/* ------------------------------- Contracts ------------------------------ */

function ContractsTab({
  company,
  onSave,
}: {
  company: Company;
  onSave: (v: Partial<Company>) => Promise<boolean | undefined>;
}) {
  const profile = company.contract_profile ?? {};
  const [state, setState] = useState(profile.state || company.state || "");
  const [contract, setContract] = useState(profile.contract_clause ?? "");
  const [contingency, setContingency] = useState(profile.contingency_clause ?? "");
  const [payment, setPayment] = useState(profile.payment_terms ?? "");
  const [saving, setSaving] = useState(false);

  const legal = useMemo(() => legalForState(state), [state]);

  async function save() {
    setSaving(true);
    const ok = await onSave({
      contract_profile: {
        state,
        contract_clause: contract.trim(),
        contingency_clause: contingency.trim(),
        payment_terms: payment.trim(),
      },
    });
    setSaving(false);
    if (ok) toast.success("Contract settings saved");
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Governing state</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Contracts and contingencies keep the exact same structure — only the state-required
          legal language, the company logo and the company info change.
        </p>
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="field-input mt-3 max-w-[200px]"
        >
          <option value="">— Select state —</option>
          {US_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">{legal.name}</strong> — {legal.rescissionDays}-day
          right to cancel.{legal.notes ? ` ${legal.notes}` : ""}
        </div>
        <button
          type="button"
          onClick={() => {
            setContract(legal.contractClause);
            setContingency(legal.contingencyClause);
            toast.success(`Loaded ${legal.name} default language`);
          }}
          className="mt-3 h-9 rounded-md border border-border px-3 text-xs font-semibold hover:bg-accent"
        >
          Load {legal.name} default language
        </button>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Residential contract — legal clause</h2>
        <textarea
          value={contract}
          onChange={(e) => setContract(e.target.value)}
          rows={10}
          placeholder={legal.contractClause}
          className="field-input mt-2 font-mono text-xs leading-relaxed"
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Insurance contingency — legal clause</h2>
        <textarea
          value={contingency}
          onChange={(e) => setContingency(e.target.value)}
          rows={8}
          placeholder={legal.contingencyClause}
          className="field-input mt-2 font-mono text-xs leading-relaxed"
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Payment terms</h2>
        <textarea
          value={payment}
          onChange={(e) => setPayment(e.target.value)}
          rows={4}
          placeholder="e.g. Deposit due at material delivery, balance on completion."
          className="field-input mt-2 text-sm"
        />
      </section>

      <button
        onClick={save}
        disabled={saving}
        className="btn-brand h-10 rounded-md px-4 text-sm font-semibold disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save contract settings"}
      </button>
    </div>
  );
}

/* ------------------------------- Documents ------------------------------ */

const DOC_CATEGORIES = [
  "general",
  "insurance certificate",
  "license",
  "w-9",
  "warranty",
  "contract template",
  "brand asset",
];

function DocumentsTab({
  companyId,
  docs,
  reload,
}: {
  companyId: string;
  docs: Doc[];
  reload: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(DOC_CATEGORIES[0]);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    let filePath: string | null = null;
    if (file) {
      const path = `${companyId}/docs/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error } = await supabase.storage
        .from("company-assets")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        setBusy(false);
        return toast.error(error.message);
      }
      filePath = path;
    }
    const { error } = await supabase.from("company_documents").insert({
      company_id: companyId,
      name: name.trim() || file?.name || "Untitled",
      category,
      file_url: filePath,
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setName("");
    setNotes("");
    setFile(null);
    await reload();
    toast.success("Document saved");
  }

  async function open(doc: Doc) {
    if (!doc.file_url) return;
    const { data, error } = await supabase.storage
      .from("company-assets")
      .createSignedUrl(doc.file_url, 300);
    if (error || !data) return toast.error(error?.message ?? "Could not open file");
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function remove(doc: Doc) {
    if (doc.file_url) {
      await supabase.storage.from("company-assets").remove([doc.file_url]);
    }
    const { error } = await supabase.from("company_documents").delete().eq("id", doc.id);
    if (error) return toast.error(error.message);
    await reload();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Add a company document</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Name">
            <input
              className="field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Certificate of insurance 2026"
            />
          </Field>
          <Field label="Category">
            <select
              className="field-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {DOC_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="File">
            <input
              type="file"
              className="field-input file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>
        </div>
        <Field label="Notes">
          <input
            className="field-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <button
          type="submit"
          disabled={busy}
          className="btn-brand flex h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> {busy ? "Saving…" : "Add document"}
        </button>
      </form>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Documents ({docs.length})</h2>
        </div>
        {docs.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No documents yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Notes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      {d.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="rounded bg-muted px-2 py-0.5">{d.category}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{d.notes ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {d.file_url && (
                      <button
                        onClick={() => open(d)}
                        className="mr-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => remove(d)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

/* --------------------------------- Team --------------------------------- */

function TeamTab({
  reps,
  invites,
  email,
  setEmail,
  role,
  setRole,
  submitting,
  sendInvite,
  removeInvite,
  inviteLink,
}: {
  reps: Rep[];
  invites: Invite[];
  email: string;
  setEmail: (v: string) => void;
  role: (typeof ROLES)[number];
  setRole: (v: (typeof ROLES)[number]) => void;
  submitting: boolean;
  sendInvite: (e: FormEvent) => void;
  removeInvite: (id: string) => void;
  inviteLink: (token: string) => string;
}) {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Reps ({reps.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Card</th>
            </tr>
          </thead>
          <tbody>
            {reps.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No reps yet — invite the first one below.
                </td>
              </tr>
            ) : (
              reps.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    {[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">{r.role}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.onboarding_completed_at ? (
                      <span className="font-medium text-green-600">Active</span>
                    ) : (
                      <span className="text-muted-foreground">Onboarding</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.card_slug ? (
                      <a
                        href={`/c/${r.card_slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        /c/{r.card_slug} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Invite a rep</h2>
        <form onSubmit={sendInvite} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs font-semibold text-muted-foreground">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rep@example.com"
              className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
              className="mt-1 h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting || !email}
            className="btn-brand flex h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" />
            {submitting ? "Sending…" : "Send invite"}
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Invites ({invites.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Expires</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No invites yet.
                </td>
              </tr>
            ) : (
              invites.map((i) => {
                const expired = new Date(i.expires_at) < new Date();
                const status = i.accepted_at ? "accepted" : expired ? "expired" : "pending";
                return (
                  <tr key={i.id} className="border-t border-border">
                    <td className="px-4 py-3">{i.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-muted px-2 py-0.5 text-xs">{i.role}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">{status}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(i.expires_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {status === "pending" && (
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(inviteLink(i.token));
                            toast.success("Invite link copied");
                          }}
                          className="mr-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          <Copy className="h-3 w-3" /> Copy link
                        </button>
                      )}
                      <button
                        onClick={() => removeInvite(i.id)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
