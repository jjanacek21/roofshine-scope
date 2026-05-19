import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listMarkets } from "@/lib/markets.functions";
import { ArrowLeft, Copy, Send, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/companies/$id")({
  component: AdminCompanyDetail,
});

type Company = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  logo_url: string | null;
  created_at: string;
  default_market_id: string | null;
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

const ROLES = ["owner", "admin", "estimator", "member"] as const;

function AdminCompanyDetail() {
  const { id } = Route.useParams();
  const [company, setCompany] = useState<Company | null>(null);
  const [reps, setReps] = useState<Rep[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("member");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: co }, { data: ps }, { data: invs }] = await Promise.all([
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
    ]);
    setCompany(co as Company | null);
    setReps((ps as Rep[]) ?? []);
    setInvites((invs as Invite[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const inviteLink = (token: string) =>
    `${window.location.origin}/onboarding?invite=${token}`;

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
        body: { email: email.trim().toLowerCase(), inviteUrl: inviteLink(token) },
      });
    } catch {
      // ignore
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

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }
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
    <div className="space-y-8">
      <div>
        <Link
          to="/admin/companies"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> All companies
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{company.name}</h1>
        <p className="text-sm text-muted-foreground">
          {company.email ?? "—"} {company.phone ? ` · ${company.phone}` : ""}
        </p>
      </div>

      {/* Reps */}
      <section className="rounded-xl border border-border bg-card">
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
                      <span className="text-green-600 font-medium">Active</span>
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

      {/* Invite */}
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
              onChange={(e) => setRole(e.target.value as typeof role)}
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

      {/* Pending invites */}
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
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={
                          status === "accepted"
                            ? "font-medium text-green-600"
                            : status === "expired"
                              ? "text-muted-foreground"
                              : "text-foreground"
                        }
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(i.expires_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {!i.accepted_at && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(inviteLink(i.token));
                              toast.success("Invite link copied");
                            }}
                            className="flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-muted"
                          >
                            <Copy className="h-3 w-3" /> Copy link
                          </button>
                        )}
                        <button
                          onClick={() => removeInvite(i.id)}
                          className="flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
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
