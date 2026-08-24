import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cbAdminListUsers, cbAdminSetMember, type CbAdminUserRow } from "@/lib/cb-admin.functions";

type Role = "owner" | "admin" | "rep";

/** Every Claim Buddy user across every company, with role and access control. */
export function CbUsersTab() {
  const [q, setQ] = useState("");
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["cb-admin-users"],
    queryFn: () => cbAdminListUsers(),
  });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list: CbAdminUserRow[] = data ?? [];
    if (!needle) return list;
    return list.filter(
      (u) =>
        (u.email ?? "").toLowerCase().includes(needle) ||
        (u.name ?? "").toLowerCase().includes(needle) ||
        u.memberships.some((m) => m.workspace_name.toLowerCase().includes(needle)),
    );
  }, [data, q]);

  async function setMember(
    workspaceId: string,
    userId: string,
    patch: { role?: Role; isActive?: boolean; remove?: boolean },
  ) {
    try {
      await cbAdminSetMember({ data: { workspaceId, userId, ...patch } });
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update the user");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, email or company"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          Refresh
        </Button>
      </div>

      <div className="space-y-2">
        {rows.map((u) => (
          <div key={u.user_id} className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold">{u.name || u.email || "User"}</p>
            <p className="text-xs text-muted-foreground">{u.email}</p>

            <div className="mt-3 space-y-2">
              {u.memberships.map((m) => (
                <div
                  key={`${m.workspace_id}-${u.user_id}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{m.workspace_name}</p>
                    {m.last_active_at ? (
                      <p className="text-xs text-muted-foreground">
                        active {new Date(m.last_active_at).toLocaleDateString()}
                      </p>
                    ) : null}
                  </div>
                  {!m.is_active ? <Badge variant="destructive">Deactivated</Badge> : null}
                  <Select
                    value={m.role}
                    onValueChange={(v) => void setMember(m.workspace_id, u.user_id, { role: v as Role })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rep">Rep</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void setMember(m.workspace_id, u.user_id, { isActive: !m.is_active })
                    }
                  >
                    {m.is_active ? "Deactivate" : "Reactivate"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void setMember(m.workspace_id, u.user_id, { remove: true })}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users match that search.</p>
        ) : null}
      </div>
    </div>
  );
}
