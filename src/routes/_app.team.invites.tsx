import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { Copy, Trash2, Send, Mail } from "lucide-react";

export const Route = createFileRoute("/_app/team/invites")({
  component: TeamInvites,
});

type Invite = {
  id: string;
  email: string;
  role: "admin" | "estimator" | "member";
  token: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
};

const INVITABLE_ROLES = ["admin", "estimator", "member"] as const;

function TeamInvites() {
  const { data: me } = useProfile();
  const [rows, setRows] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof INVITABLE_ROLES)[number]>("member");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!me?.company_id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("company_invites")
      .select("id, email, role, token, accepted_at, expires_at, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as Invite[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.company_id]);

  const inviteLink = (token: string) =>
    `${window.location.origin}/onboarding?invite=${token}`;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!me?.company_id || !me.id) return;
    setSubmitting(true);

    const { data: created, error } = await supabase
      .from("company_invites")
      .insert({
        company_id: me.company_id,
        invited_by: me.id,
        email: email.trim().toLowerCase(),
        role,
      })
      .select()
      .single();

    if (error || !created) {
      setSubmitting(false);
      toast.error(error?.message ?? "Could not create invite");
      return;
    }

    // Best-effort: try to send the invite email via the edge function
    try {
      await supabase.functions.invoke("send-invite-email", {
        body: {
          email: created.email,
          token: created.token,
          inviteUrl: inviteLink(created.token),
        },
      });
    } catch {
      // ignore — admin can copy the link manually
    }

    toast.success(`Invite created for ${created.email}`);
    setEmail("");
    setRole("member");
    setSubmitting(false);
    load();
  }

  async function deleteInvite(id: string) {
    const { error } = await supabase.from("company_invites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((r) => r.filter((i) => i.id !== id));
  }

  const [resendingId, setResendingId] = useState<string | null>(null);
  async function resendInvite(invite: Invite) {
    setResendingId(invite.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-invite-email", {
        body: {
          email: invite.email,
          token: invite.token,
          inviteUrl: inviteLink(invite.token),
        },
      });
      if (error) throw error;
      if (data?.skipped) {
        toast.warning("Email service not configured — copy link instead");
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(`Invite resent to ${invite.email}`);
      }
    } catch (e) {
      toast.error((e as Error)?.message ?? "Failed to resend invite");
    } finally {
      setResendingId(null);
    }
  }

  function copy(token: string) {
    navigator.clipboard.writeText(inviteLink(token));
    toast.success("Invite link copied");
  }

  return (
    <div className="space-y-6">
      {/* Create invite */}
      <form
        onSubmit={onSubmit}
        className="rounded-xl border border-border bg-card p-5"
      >
        <h2 className="text-sm font-semibold">Invite a teammate</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          They'll receive a link to join your company. Links expire in 14 days.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs font-semibold text-muted-foreground">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
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
              {INVITABLE_ROLES.map((r) => (
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
        </div>
      </form>

      {/* Invite list */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
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
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No invites yet.
                </td>
              </tr>
            ) : (
              rows.map((i) => {
                const expired = new Date(i.expires_at) < new Date();
                const status = i.accepted_at
                  ? "accepted"
                  : expired
                  ? "expired"
                  : "pending";
                return (
                  <tr key={i.id} className="border-t border-border">
                    <td className="px-4 py-3">{i.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-muted px-2 py-0.5 text-xs">{i.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          status === "accepted"
                            ? "text-green-600 text-xs font-medium"
                            : status === "expired"
                            ? "text-muted-foreground text-xs"
                            : "text-foreground text-xs"
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
                          <>
                            <button
                              onClick={() => resendInvite(i)}
                              disabled={resendingId === i.id}
                              className="flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-muted disabled:opacity-60"
                            >
                              <Mail className="h-3 w-3" />
                              {resendingId === i.id ? "Sending…" : "Resend"}
                            </button>
                            <button
                              onClick={() => copy(i.token)}
                              className="flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-muted"
                            >
                              <Copy className="h-3 w-3" /> Copy link
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => deleteInvite(i.id)}
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
      </div>
    </div>
  );
}
