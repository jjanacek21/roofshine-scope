import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Building2, ArrowRight, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { adminListCompanies, adminSaveCompany } from "@/lib/company-admin.functions";
import { CB_TIER_LABEL, type CbTier } from "@/lib/cbFeatures";
import { US_STATES } from "@/lib/state-contract-law";

export const Route = createFileRoute("/admin/companies/")({
  component: AdminCompanies,
});

function AdminCompanies() {
  const list = useServerFn(adminListCompanies);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: () => list(),
  });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data
      .filter((c) => (showArchived ? c.status === "archived" : c.status !== "archived"))
      .filter((c) => !q || `${c.name} ${c.email ?? ""}`.toLowerCase().includes(q));
  }, [data, query, showArchived]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Companies</h1>
          <p className="text-sm text-muted-foreground">
            Every organization on the platform — modules, Claim Buddy tier and members.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="btn-brand flex h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold">
              <Plus className="h-4 w-4" /> Add company
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add a company</DialogTitle>
            </DialogHeader>
            <NewCompanyForm onDone={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            className="field-input pl-8"
            placeholder="Search companies"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex rounded-md border border-border p-0.5 text-xs font-semibold">
          {[
            { label: "Active", v: false },
            { label: "Archived", v: true },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setShowArchived(o.v)}
              className={`rounded px-3 py-1.5 ${
                showArchived === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Company</th>
              <th className="px-4 py-3 text-left">Modules</th>
              <th className="px-4 py-3 text-left">Claim Buddy</th>
              <th className="px-4 py-3 text-left">Members</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Building2 className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {showArchived ? "No archived companies." : "No companies yet."}
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.email ?? "—"} {c.phone ? ` · ${c.phone}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-72 flex-wrap gap-1">
                      {c.modules.length === 0 ? (
                        <span className="text-xs text-muted-foreground">None</span>
                      ) : (
                        c.modules.map((m) => (
                          <span
                            key={m}
                            className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium"
                          >
                            {m}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {c.cb_workspace_id ? (
                      <span className="text-xs font-semibold">
                        {CB_TIER_LABEL[(c.cb_tier ?? "basic") as CbTier] ?? c.cb_tier}
                        {c.cb_status && c.cb_status !== "active" ? ` · ${c.cb_status}` : ""}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono-num">{c.member_count}</td>
                  <td className="px-4 py-3 text-xs capitalize">{c.status}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/admin/companies/$id"
                      params={{ id: c.id }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      Manage <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewCompanyForm({ onDone }: { onDone: () => void }) {
  const save = useServerFn(adminSaveCompany);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    city: "",
    state: "",
    postal_code: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { id } = await save({
        data: {
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          website: form.website.trim() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          postal_code: form.postal_code.trim() || null,
        },
      });
      toast.success("Company created — now grant its features");
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
      qc.invalidateQueries({ queryKey: ["feature-admin"] });
      onDone();
      navigate({ to: "/admin/companies/$id", params: { id }, search: { tab: "Features" } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Company name" required>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="field-input"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone">
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="field-input"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="field-input"
          />
        </Field>
      </div>
      <Field label="Street address">
        <input
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          className="field-input"
        />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="City">
          <input
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="field-input"
          />
        </Field>
        <Field label="State">
          <select
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
            className="field-input"
          >
            <option value="">—</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ZIP">
          <input
            value={form.postal_code}
            onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
            className="field-input"
          />
        </Field>
      </div>
      <Field label="Website">
        <input
          value={form.website}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
          className="field-input"
        />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting || !form.name}
          className="btn-brand h-10 rounded-md px-4 text-sm font-semibold disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create company"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
