import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useIsCompanyAdmin } from "@/hooks/useProfile";
import { toast } from "sonner";
import { Send, Trash2, Copy } from "lucide-react";

type Rep = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string;
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

/** Roles a company admin may hand out. Owner and super_admin are blocked by RLS. */
const ASSIGNABLE_ROLES = ["member", "admin"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

function inviteLink(token: string) {
  return `${window.location.origin}/accept-invite?token=${token}`;
}

/**
 * Company-facing team management. Mirrors the super-admin Members tab but
 * scoped to the signed-in user's own company, so an owner can add their own
 * reps without going through the platform admin.
 */
export function TeamTab() {
  const { data: profile } = useProfile();
  const isAdmin = useIsCompanyAdmin();
  const companyId = profile?.company_id ?? null;
  const qc = useQueryClient();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("member");
  const [submitting, setSubmitting] = useState(false);

  const { data: reps = [] } = useQuery({
    queryKey: ["team-reps", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, role")
        .eq("company_id", companyId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Rep[];
    },
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["team-invites", companyId],
    enabled: !!companyId && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_invites")
        .select("id, email, role, token, accepted_at, expires_at, created_at")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invite[];
    },
  });

  async function sendInvite(e: FormEvent) {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!addr || !companyId) return;
    setSubmitting(true);

    const { data: auth } = await supabase.auth.getUser();
    const { data: row, error } = await supabase
      .from("company_invites")
      .insert({
        company_id: companyId,
        email: addr,
        role,
        invited_by: auth.user!.id,
      })
      .select("token")
      .maybeSingle();

    if (error || !row) {
      toast.error(error?.message ?? "Could not create the invite");
      setSubmitting(false);
      return;
    }

    // The email is best-effort — the invite exists either way, and the link
    // below can be copied and sent by hand if delivery fails.
    try {
      await supabase.functions.invoke("send-invite-email", {
        body: {
          email: addr,
          inviteUrl: inviteLink(row.token),
        },
      });
      toast.success(`Invite sent to ${addr}`);
    } catch {
      toast.warning("Invite created, but the email could not be sent. Copy the link instead.");
    }

    setEmail("");
    setSubmitting(false);
    qc.invalidateQueries({ queryKey: ["team-invites", companyId] });
  }

  async function revoke(id: string) {
    const { error } = await supabase.from("company_invites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Invite revoked");
    qc.invalidateQueries({ queryKey: ["team-invites", companyId] });
  }

  async function changeRole(userId: string, next: AssignableRole) {
    const { error } = await supabase.from("profiles").update({ role: next }).eq("id", userId);
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    qc.invalidateQueries({ queryKey: ["team-reps", companyId] });
  }

  const pending = invites.filter((i) => !i.accepted_at);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-semibold">Your team ({reps.length})</h2>
        <div
          className="mt-3 overflow-hidden rounded-xl border"
          style={{ borderColor: "var(--border)" }}
        >
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: "var(--bg-hover)" }}>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
              </tr>
            </thead>
            <tbody>
              {reps.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                    No one on the team yet.
                  </td>
                </tr>
              ) : (
                reps.map((r) => {
                  const isSelf = r.id === profile?.id;
                  const isOwner = r.role === "owner" || r.role === "super_admin";
                  return (
                    <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="px-4 py-3">
                        {[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}
                        {isSelf && (
                          <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.email ?? "—"}</td>
                      <td className="px-4 py-3">
                        {isOwner || !isAdmin || isSelf ? (
                          <span className="rounded-full border px-2 py-0.5 text-xs capitalize">
                            {r.role}
                          </span>
                        ) : (
                          <select
                            value={r.role}
                            onChange={(e) => changeRole(r.id, e.target.value as AssignableRole)}
                            className="h-8 rounded-md border px-2 text-xs"
                            style={{
                              borderColor: "var(--border)",
                              backgroundColor: "var(--bg-card)",
                            }}
                          >
                            {ASSIGNABLE_ROLES.map((x) => (
                              <option key={x} value={x}>
                                {x}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isAdmin && (
        <>
          <section>
            <h2 className="text-sm font-semibold">Invite someone</h2>
            <form onSubmit={sendInvite} className="mt-3 flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="invite-email">
                  Email
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rep@example.com"
                  className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground" htmlFor="invite-role">
                  Role
                </label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as AssignableRole)}
                  className="mt-1 h-10 rounded-md border px-3 text-sm"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
                >
                  {ASSIGNABLE_ROLES.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: "var(--brand)" }}
              >
                <Send className="h-4 w-4" />
                {submitting ? "Sending…" : "Send invite"}
              </button>
            </form>
          </section>

          <section>
            <h2 className="text-sm font-semibold">Pending invites ({pending.length})</h2>
            <div
              className="mt-3 overflow-hidden rounded-xl border"
              style={{ borderColor: "var(--border)" }}
            >
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: "var(--bg-hover)" }}>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Expires</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                        No pending invites.
                      </td>
                    </tr>
                  ) : (
                    pending.map((i) => (
                      <tr key={i.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                        <td className="px-4 py-3">{i.email}</td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">{i.role}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(i.expires_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(inviteLink(i.token));
                                toast.success("Invite link copied");
                              }}
                              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
                              style={{ borderColor: "var(--border)" }}
                            >
                              <Copy className="h-3 w-3" /> Copy link
                            </button>
                            <button
                              onClick={() => revoke(i.id)}
                              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-[var(--danger)]"
                              style={{ borderColor: "var(--border)" }}
                            >
                              <Trash2 className="h-3 w-3" /> Revoke
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
