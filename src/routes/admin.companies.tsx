import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Building2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/companies")({
  component: AdminCompanies,
});

type Row = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  rep_count: number;
  pending_invites: number;
};

function AdminCompanies() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name, email, phone, created_at")
      .order("created_at", { ascending: false });

    const ids = (companies ?? []).map((c) => c.id);
    const [{ data: profilesByCo }, { data: invitesByCo }] = await Promise.all([
      ids.length
        ? supabase.from("profiles").select("company_id").in("company_id", ids)
        : Promise.resolve({ data: [] as { company_id: string }[] }),
      ids.length
        ? supabase
            .from("company_invites")
            .select("company_id, accepted_at, expires_at")
            .in("company_id", ids)
        : Promise.resolve({ data: [] as { company_id: string; accepted_at: string | null; expires_at: string }[] }),
    ]);

    const repCounts = new Map<string, number>();
    (profilesByCo ?? []).forEach((p) => {
      repCounts.set(p.company_id!, (repCounts.get(p.company_id!) ?? 0) + 1);
    });
    const inviteCounts = new Map<string, number>();
    (invitesByCo ?? []).forEach((i) => {
      if (i.accepted_at) return;
      if (new Date(i.expires_at) < new Date()) return;
      inviteCounts.set(i.company_id, (inviteCounts.get(i.company_id) ?? 0) + 1);
    });

    setRows(
      (companies ?? []).map((c) => ({
        ...c,
        rep_count: repCounts.get(c.id) ?? 0,
        pending_invites: inviteCounts.get(c.id) ?? 0,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Companies</h1>
          <p className="text-sm text-muted-foreground">
            All organizations on the platform.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="btn-brand flex h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold">
              <Plus className="h-4 w-4" /> New company
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create a company</DialogTitle>
            </DialogHeader>
            <NewCompanyForm
              onCreated={() => {
                setOpen(false);
                load();
              }}
            />
          </DialogContent>
        </Dialog>
      </header>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Company</th>
              <th className="px-4 py-3 text-left">Reps</th>
              <th className="px-4 py-3 text-left">Pending invites</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Building2 className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  No companies yet. Create your first one.
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
                  <td className="px-4 py-3 font-mono-num">{c.rep_count}</td>
                  <td className="px-4 py-3 font-mono-num">{c.pending_invites}</td>
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

function NewCompanyForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      // 1. Create company via security-definer RPC (super admin only)
      const { data: companyId, error: cErr } = await supabase.rpc(
        "create_company_as_super_admin",
        {
          _name: name.trim(),
          _address: address.trim() || undefined,
          _phone: phone.trim() || undefined,
          _email: email.trim() || undefined,
          _website: website.trim() || undefined,
        },
      );
      if (cErr || !companyId) throw new Error(cErr?.message ?? "Could not create company");

      // 2. Create owner invite
      const { data: invite, error: iErr } = await supabase.rpc(
        "create_company_invite_as_super_admin",
        {
          _company_id: companyId as string,
          _email: ownerEmail.trim().toLowerCase(),
          _role: "owner",
        },
      );
      if (iErr || !invite) throw new Error(iErr?.message ?? "Could not create invite");

      const inviteUrl = `${window.location.origin}/onboarding?invite=${(invite as { token: string }).token}`;
      try {
        await supabase.functions.invoke("send-invite-email", {
          body: { email: ownerEmail.trim().toLowerCase(), inviteUrl },
        });
      } catch {
        // Non-fatal — link is shown in toast for copy-paste
      }
      navigator.clipboard?.writeText(inviteUrl).catch(() => {});
      toast.success("Company created. Invite link copied to clipboard.");
      onCreated();
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
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="field-input"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="field-input" />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
          />
        </Field>
      </div>
      <Field label="Address">
        <input value={address} onChange={(e) => setAddress(e.target.value)} className="field-input" />
      </Field>
      <Field label="Website">
        <input value={website} onChange={(e) => setWebsite(e.target.value)} className="field-input" />
      </Field>
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <Field label="Owner email (will receive invite)" required>
          <input
            required
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder="owner@company.com"
            className="field-input"
          />
        </Field>
        <p className="mt-2 text-[11px] text-muted-foreground">
          The invite link expires in 14 days. They'll set a password and complete their profile.
        </p>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting || !name || !ownerEmail}
          className="btn-brand h-10 rounded-md px-4 text-sm font-semibold disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create & invite owner"}
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
