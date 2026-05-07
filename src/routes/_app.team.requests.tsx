import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

export const Route = createFileRoute("/_app/team/requests")({
  component: TeamRequestsPage,
});

type JoinRequest = {
  id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  profile?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
};

function TeamRequestsPage() {
  const { data: me } = useProfile();
  const [rows, setRows] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  async function load() {
    if (!me?.company_id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("company_join_requests")
      .select("id, user_id, status, requested_at")
      .eq("company_id", me.company_id)
      .eq("status", "pending")
      .order("requested_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const requests = (data ?? []) as JoinRequest[];
    if (requests.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    const userIds = requests.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", userIds);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    setRows(
      requests.map((r) => ({
        ...r,
        profile: byId.get(r.user_id) as JoinRequest["profile"],
      })),
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.company_id]);

  async function decide(id: string, action: "approve" | "reject") {
    setActingId(id);
    const fn = action === "approve" ? "approve_join_request" : "reject_join_request";
    const { error } = await supabase.rpc(fn, { _id: id });
    setActingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(action === "approve" ? "User added to your company" : "Request rejected");
    load();
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  if (rows.length === 0) {
    return (
      <div
        className="rounded-xl p-8 text-center text-sm"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
      >
        No pending join requests.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Requested</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const name = [r.profile?.first_name, r.profile?.last_name].filter(Boolean).join(" ") || "—";
            return (
              <tr key={r.id} className="border-t border-border/40">
                <td className="px-4 py-3">{name}</td>
                <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>{r.profile?.email ?? "—"}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  {new Date(r.requested_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => decide(r.id, "approve")}
                      disabled={actingId === r.id}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-semibold hover:bg-muted disabled:opacity-60"
                    >
                      <Check className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => decide(r.id, "reject")}
                      disabled={actingId === r.id}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-destructive/50 bg-background px-3 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60"
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
