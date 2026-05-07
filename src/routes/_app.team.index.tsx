import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { deleteTeamMember } from "@/lib/team.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/team/")({
  component: TeamMembers,
});

type Member = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: "owner" | "admin" | "estimator" | "member" | "super_admin";
  created_at: string;
};

// Roles a company admin can assign (cannot create owners or super_admins)
const ASSIGNABLE_ROLES = ["admin", "estimator", "member"] as const;

function TeamMembers() {
  const { data: me } = useProfile();
  const [rows, setRows] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteFn = useServerFn(deleteTeamMember);

  const isSuperAdmin = me?.role === "super_admin";
  const isCompanyAdmin = me?.role === "owner" || me?.role === "admin";

  const handleDelete = async (u: Member) => {
    const fullName =
      [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "this user";
    if (!confirm(`Permanently delete ${fullName}? This removes their account and cannot be undone.`)) return;
    setDeletingId(u.id);
    try {
      await deleteFn({ data: { userId: u.id } });
      toast.success("User deleted");
      setRows((r) => r.filter((p) => p.id !== u.id));
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete user");
    } finally {
      setDeletingId(null);
    }
  };

    if (!me?.company_id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, role, created_at")
      .eq("company_id", me.company_id)
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data as Member[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.company_id]);

  const updateRole = async (id: string, role: Member["role"]) => {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    setRows((r) => r.map((p) => (p.id === id ? { ...p, role } : p)));
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Name</th>
            <th className="px-4 py-3 text-left">Email</th>
            <th className="px-4 py-3 text-left">Role</th>
            <th className="px-4 py-3 text-left">Joined</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                No teammates yet. Invite one from the Invites tab.
              </td>
            </tr>
          ) : (
            rows.map((u) => {
              const isSelf = u.id === me?.id;
              const isOwner = u.role === "owner";
              const isSuper = u.role === "super_admin";
              const canEdit = !isSelf && !isOwner && !isSuper;
              const fullName =
                [u.first_name, u.last_name].filter(Boolean).join(" ") || "—";
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    {fullName} {isSelf && <span className="text-muted-foreground">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    {canEdit ? (
                      <select
                        value={u.role}
                        onChange={(e) => updateRole(u.id, e.target.value as Member["role"])}
                        className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded bg-muted px-2 py-0.5 text-xs">{u.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
