import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CbAdminShell } from "@/components/cb/CbAdminShell";
import { CbCard, CbButton, CbBadge, CbSkeleton, CbEmptyState } from "@/components/cb/primitives";
import { CbField } from "@/components/cb/forms";
import { CbStagger } from "@/components/cb/motion";
import { useCbSession } from "@/components/auth/CbSessionProvider";

export const Route = createFileRoute("/cb/admin/team")({
  head: () => ({
    meta: [
      { title: "Team — Claim Buddy admin" },
      {
        name: "description",
        content: "Invite reps, set who can see every inspection, and deactivate seats when someone leaves.",
      },
      { property: "og:title", content: "Team — Claim Buddy admin" },
      { property: "og:description", content: "Seats, roles and invitations for your Claim Buddy workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbAdminTeamPage,
});

type Role = "admin" | "manager" | "rep";

interface Seat {
  user_id: string;
  email: string | null;
  name: string | null;
  role: Role;
  is_active: boolean;
  last_active_at: string | null;
  joined_at: string;
  job_count: number;
}

interface Invite {
  id: string;
  email: string;
  role: Role;
  created_at: string;
}

const ROLE_COPY: Record<Role, string> = {
  admin: "Sees every inspection. Manages branding, seats and pricing.",
  manager: "Sees every inspection in the workspace.",
  rep: "Sees only the inspections they created.",
};

function CbAdminTeamPage() {
  const { workspace } = useCbSession();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("rep");
  const [inviting, setInviting] = useState(false);

  const key = ["cb-seats", workspace?.id];
  const seatsQuery = useQuery({
    queryKey: key,
    enabled: !!workspace?.id && workspace.role === "admin",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cb_seats", { _ws: workspace!.id });
      if (error) throw error;
      return (data ?? {}) as unknown as { seats: Seat[]; invites: Invite[] };
    },
  });

  const seats = seatsQuery.data?.seats ?? [];
  const invites = seatsQuery.data?.invites ?? [];

  async function invite() {
    if (!workspace) return;
    if (!email.includes("@")) {
      toast.error("That doesn't look like an email address yet.");
      return;
    }
    setInviting(true);
    const { data, error } = await supabase.rpc("cb_invite_member", {
      _ws: workspace.id,
      _email: email.trim(),
      _role: role,
    });
    setInviting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const seated = (data as { seated?: boolean } | null)?.seated;
    toast.success(
      seated
        ? "They already have an account — seat added right now."
        : "Invite saved. They'll be seated automatically the first time they sign in.",
    );
    setEmail("");
    void qc.invalidateQueries({ queryKey: key });
  }

  async function setActive(userId: string, active: boolean) {
    if (!workspace) return;
    const { error } = await supabase.rpc("cb_set_member_active", {
      _ws: workspace.id,
      _user: userId,
      _active: active,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(active ? "Seat reactivated." : "Seat deactivated.");
    void qc.invalidateQueries({ queryKey: key });
  }

  async function revoke(id: string) {
    const { error } = await supabase.rpc("cb_revoke_invite", { _id: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: key });
  }

  return (
    <CbAdminShell title="Team" subtitle="Who's on the roof, and what they can see.">
      <div className="space-y-5">
        <CbCard elevation="raised" style={{ padding: 18 }}>
          <p className="cb-microlabel">Invite someone</p>
          <div className="mt-3 space-y-3">
            <CbField
              label="Work email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <div className="flex flex-wrap gap-2">
              {(["rep", "manager", "admin"] as Role[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  aria-pressed={role === r}
                  className="cb-chip"
                  style={
                    role === r
                      ? { background: "var(--cb-accent)", color: "#fff", borderColor: "transparent" }
                      : undefined
                  }
                >
                  {r === "rep" ? "Rep" : r === "manager" ? "Manager" : "Admin"}
                </button>
              ))}
            </div>
            <p className="text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
              {ROLE_COPY[role]}
            </p>
            <CbButton block loading={inviting} loadingText="Sending…" onClick={invite}>
              Send invite
            </CbButton>
          </div>
        </CbCard>

        {invites.length ? (
          <CbCard elevation="card" style={{ padding: 18 }}>
            <p className="cb-microlabel">Pending invites</p>
            <div className="mt-3 space-y-2">
              {invites.map((i) => (
                <div key={i.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px]">{i.email}</p>
                    <p className="text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
                      {i.role}
                    </p>
                  </div>
                  <CbButton size="md" variant="ghost" onClick={() => void revoke(i.id)}>
                    Revoke
                  </CbButton>
                </div>
              ))}
            </div>
          </CbCard>
        ) : null}

        {seatsQuery.isLoading ? (
          <CbSkeleton height={160} radius={18} />
        ) : seats.length === 0 ? (
          <CbEmptyState headline="No seats yet." />
        ) : (
          <CbStagger className="space-y-3">
            {seats.map((s) => (
              <CbCard key={s.user_id} elevation="card" style={{ padding: 16 }}>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{s.name || s.email || "Teammate"}</p>
                    <p className="truncate text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
                      {s.email}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <CbBadge tone={s.role === "rep" ? "neutral" : "accent"}>{s.role}</CbBadge>
                      {!s.is_active ? <CbBadge tone="danger">Deactivated</CbBadge> : null}
                      <span className="text-[11.5px]" style={{ color: "var(--cb-text-muted)" }}>
                        <span className="cb-num">{s.job_count}</span> inspections
                      </span>
                      <span className="text-[11.5px]" style={{ color: "var(--cb-text-muted)" }}>
                        {s.last_active_at
                          ? `Active ${new Date(s.last_active_at).toLocaleDateString()}`
                          : "Not signed in yet"}
                      </span>
                    </div>
                  </div>
                  <CbButton
                    size="md"
                    variant={s.is_active ? "ghost" : "secondary"}
                    onClick={() => void setActive(s.user_id, !s.is_active)}
                  >
                    {s.is_active ? "Deactivate" : "Reactivate"}
                  </CbButton>
                </div>
              </CbCard>
            ))}
          </CbStagger>
        )}
      </div>
    </CbAdminShell>
  );
}
