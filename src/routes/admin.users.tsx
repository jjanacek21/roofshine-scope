import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus, Copy, Trash2, X, Pencil } from "lucide-react";
import { deleteTeamMember, updateUserAsAdmin } from "@/lib/team.functions";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

type Profile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: "owner" | "admin" | "estimator" | "member" | "super_admin";
  company_id: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
};

type Company = { id: string; name: string };

type Invite = {
  id: string;
  email: string;
  role: string;
  token: string;
  company_id: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
};

const ROLES = ["super_admin", "owner", "admin", "estimator", "member"] as const;
const ASSIGNABLE_ROLES = ["admin", "member"] as const;

function AdminUsers() {
  const [rows, setRows] = useState<Profile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: profs, error }, { data: cos }, { data: invs }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, first_name, last_name, role, company_id, onboarding_completed_at, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("companies").select("id, name").order("name"),
      supabase
        .from("company_invites")
        .select("id, email, role, token, company_id, accepted_at, expires_at, created_at")
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
    ]);
    if (error) toast.error(error.message);
    setRows((profs as Profile[]) ?? []);
    setCompanies((cos as Company[]) ?? []);
    setInvites((invs as Invite[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const companyMap = useMemo(() => {
    const m = new Map<string, string>();
    companies.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [companies]);

  const updateRole = async (id: string, role: Profile["role"]) => {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    setRows((r) => r.map((p) => (p.id === id ? { ...p, role } : p)));
  };

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      r.email?.toLowerCase().includes(s) ||
      r.first_name?.toLowerCase().includes(s) ||
      r.last_name?.toLowerCase().includes(s) ||
      companyMap.get(r.company_id ?? "")?.toLowerCase().includes(s)
    );
  });

  const inviteLink = (token: string) => `${window.location.origin}/onboarding?invite=${token}`;

  async function copyInvite(token: string) {
    await navigator.clipboard.writeText(inviteLink(token));
    toast.success("Invite link copied");
  }

  async function resendInvite(inv: Invite) {
    try {
      await supabase.functions.invoke("send-invite-email", {
        body: { email: inv.email, inviteUrl: inviteLink(inv.token) },
      });
      toast.success("Invite resent");
    } catch (e) {
      toast.error("Could not resend");
    }
  }

  async function deleteInvite(id: string) {
    const { error } = await supabase.from("company_invites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setInvites((x) => x.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">Manage reps and roles across all companies.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="h-9 w-60 rounded-md border border-border bg-background px-3 text-sm"
          />
          <button
            onClick={() => setAddOpen(true)}
            className="btn-brand inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold"
          >
            <UserPlus className="h-3.5 w-3.5" /> Add rep
          </button>
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Company</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No users.</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3">{[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.email}</td>
                  <td className="px-4 py-3 text-xs">{companyMap.get(r.company_id ?? "") ?? "—"}</td>
                  <td className="px-4 py-3">
                    <select
                      value={r.role}
                      onChange={(e) => updateRole(r.id, e.target.value as Profile["role"])}
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.onboarding_completed_at ? (
                      <span className="rounded bg-green-500/15 px-2 py-0.5 text-green-700 dark:text-green-400">Active</span>
                    ) : (
                      <span className="rounded bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-400">Pending profile</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pending invites */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Pending invites ({invites.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Company</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Expires</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No pending invites.</td></tr>
            ) : (
              invites.map((i) => {
                const expired = new Date(i.expires_at) < new Date();
                return (
                  <tr key={i.id} className="border-t border-border">
                    <td className="px-4 py-3">{i.email}</td>
                    <td className="px-4 py-3 text-xs">{companyMap.get(i.company_id) ?? "—"}</td>
                    <td className="px-4 py-3"><span className="rounded bg-muted px-2 py-0.5 text-xs">{i.role}</span></td>
                    <td className={`px-4 py-3 text-xs ${expired ? "text-red-600" : "text-muted-foreground"}`}>
                      {expired ? "Expired" : new Date(i.expires_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => copyInvite(i.token)} title="Copy link" className="rounded p-1.5 hover:bg-muted">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => resendInvite(i)} title="Resend" className="rounded px-2 py-1 text-xs hover:bg-muted">
                          Resend
                        </button>
                        <button onClick={() => deleteInvite(i.id)} title="Delete" className="rounded p-1.5 hover:bg-muted text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <AddRepDialog
          companies={companies}
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            setAddOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddRepDialog({
  companies,
  onClose,
  onCreated,
}: {
  companies: Company[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [role, setRole] = useState<(typeof ASSIGNABLE_ROLES)[number]>("member");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!companyId) return toast.error("Pick a company");
    setSubmitting(true);
    const { data, error } = await supabase.rpc("create_company_invite_as_super_admin", {
      _company_id: companyId,
      _email: email.trim().toLowerCase(),
      _role: role,
    });
    if (error || !data) {
      toast.error(error?.message ?? "Could not create invite");
      setSubmitting(false);
      return;
    }
    const { token } = data as { token: string };
    const url = `${window.location.origin}/onboarding?invite=${token}`;
    try {
      await supabase.functions.invoke("send-invite-email", {
        body: { email: email.trim().toLowerCase(), inviteUrl: url },
      });
    } catch {}
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success("Invite created — link copied");
    setSubmitting(false);
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Add rep</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          They'll receive an email to set up their password and profile.
        </p>
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-semibold text-muted-foreground">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rep@example.com"
              className="field-input mt-1 font-normal text-foreground"
            />
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            Company
            <select
              required
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="field-input mt-1 font-normal text-foreground"
            >
              <option value="">Select…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="field-input mt-1 font-normal text-foreground"
            >
              <option value="admin">Admin (manages company)</option>
              <option value="member">User (rep)</option>
            </select>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-md border border-border px-4 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !email || !companyId}
            className="btn-brand h-9 rounded-md px-4 text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Send invite"}
          </button>
        </div>
      </form>
    </div>
  );
}
