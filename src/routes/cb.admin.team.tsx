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
import { cbRequestSeats, cbResendInvite, cbSendInvite } from "@/lib/cb-team.functions";

export const Route = createFileRoute("/cb/admin/team")({
  head: () => ({
    meta: [
      { title: "Team & seats — Claim Buddy admin" },
      {
        name: "description",
        content: "Invite reps, set who can see every inspection, buy seats and deactivate people when they leave.",
      },
      { property: "og:title", content: "Team & seats — Claim Buddy admin" },
      { property: "og:description", content: "Seats, roles and invitations for your Claim Buddy company." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbAdminTeamPage,
});

type Role = "owner" | "admin" | "rep";

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

interface SeatsPayload {
  seats: Seat[];
  invites: Invite[];
  seats_purchased: number;
  seats_used: number;
  seats_pending: number;
  my_role: Role;
}

const ROLE_COPY: Record<Role, string> = {
  owner: "Everything an admin can do, plus buying seats and transferring ownership.",
  admin: "Sees every inspection and door in the company. Manages branding, seats, pricing and people.",
  rep: "Sees only the inspections they create and the doors they pin.",
};

const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", rep: "Rep" };

function CbAdminTeamPage() {
  const { workspace } = useCbSession();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("rep");
  const [inviting, setInviting] = useState(false);
  const [extraSeats, setExtraSeats] = useState("1");
  const [requesting, setRequesting] = useState(false);

  const isLeader = workspace?.role === "admin" || workspace?.role === "owner";
  const key = ["cb-seats", workspace?.id];
  const seatsQuery = useQuery({
    queryKey: key,
    enabled: !!workspace?.id && isLeader,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cb_seats", { _ws: workspace!.id });
      if (error) throw error;
      return (data ?? {}) as unknown as SeatsPayload;
    },
  });

  const seats = seatsQuery.data?.seats ?? [];
  const invites = seatsQuery.data?.invites ?? [];
  const purchased = seatsQuery.data?.seats_purchased ?? 0;
  const used = seatsQuery.data?.seats_used ?? 0;
  const pending = seatsQuery.data?.seats_pending ?? 0;
  const remaining = Math.max(0, purchased - used - pending);
  const isOwner = workspace?.role === "owner";

  async function invite() {
    if (!workspace) return;
    if (!email.includes("@")) {
      toast.error("That doesn't look like an email address yet.");
      return;
    }
    setInviting(true);
    try {
      const res = await cbSendInvite({
        data: { workspaceId: workspace.id, email: email.trim(), role },
      });
      toast.success(
        res.seated
          ? "They already have an account — seat added and they've been emailed."
          : "Invite emailed. The link works for 14 days.",
      );
      setEmail("");
      void qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send the invite");
    } finally {
      setInviting(false);
    }
  }

  async function requestSeats() {
    if (!workspace) return;
    const n = Number(extraSeats);
    if (!Number.isFinite(n) || n < 1) {
      toast.error("How many seats do you need?");
      return;
    }
    setRequesting(true);
    try {
      await cbRequestSeats({ data: { workspaceId: workspace.id, seats: Math.round(n) } });
      toast.success("Seat request sent — we'll turn them on shortly.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send the request");
    } finally {
      setRequesting(false);
    }
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

  async function changeRole(userId: string, next: Role) {
    if (!workspace) return;
    if (next === "owner" && !isOwner) {
      toast.error("Only the owner can hand over ownership.");
      return;
    }
    const { error } = await supabase
      .from("cb_workspace_members")
      .update({ role: next })
      .eq("workspace_id", workspace.id)
      .eq("user_id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Role set to ${ROLE_LABEL[next]}.`);
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

  async function resend(id: string) {
    try {
      await cbResendInvite({ data: { inviteId: id } });
      toast.success("Invite re-sent.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't re-send");
    }
  }

  const roleChoices: Role[] = isOwner ? ["rep", "admin", "owner"] : ["rep", "admin"];

  return (
    <CbAdminShell title="Team & seats" subtitle="Who's on the roof, and what they can see.">
      <div className="space-y-5">
        <CbCard elevation="raised" style={{ padding: 18 }}>
          <p className="cb-microlabel">Seats</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="cb-num" style={{ fontSize: 30, fontWeight: 700 }}>
              {used}/{purchased}
            </span>
            <span className="text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
              in use{pending ? ` · ${pending} invited` : ""} · {remaining} free
            </span>
          </div>
          {isOwner ? (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div style={{ width: 130 }}>
                <CbField
                  label="Add seats"
                  type="number"
                  inputMode="numeric"
                  value={extraSeats}
                  onChange={(e) => setExtraSeats(e.target.value)}
                />
              </div>
              <CbButton
                size="md"
                variant="secondary"
                loading={requesting}
                loadingText="Sending…"
                onClick={() => void requestSeats()}
              >
                Buy more seats
              </CbButton>
            </div>
          ) : (
            <p className="mt-3 text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
              Only the owner can buy more seats.
            </p>
          )}
        </CbCard>

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
              {roleChoices.map((r) => (
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
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
            <p className="text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
              {ROLE_COPY[role]}
            </p>
            <CbButton
              block
              loading={inviting}
              loadingText="Sending…"
              disabled={remaining <= 0}
              onClick={() => void invite()}
            >
              {remaining <= 0 ? "No seats available" : "Send invite"}
            </CbButton>
          </div>
        </CbCard>

        {invites.length ? (
          <CbCard elevation="card" style={{ padding: 18 }}>
            <p className="cb-microlabel">Pending invites</p>
            <div className="mt-3 space-y-2">
              {invites.map((i) => (
                <div key={i.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px]">{i.email}</p>
                    <p className="text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
                      {ROLE_LABEL[i.role]}
                    </p>
                  </div>
                  <CbButton size="md" variant="ghost" onClick={() => void resend(i.id)}>
                    Re-send
                  </CbButton>
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
                      <CbBadge tone={s.role === "rep" ? "neutral" : "accent"}>{ROLE_LABEL[s.role]}</CbBadge>
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
                    <div className="mt-2 flex flex-wrap gap-2">
                      {roleChoices
                        .filter((r) => r !== s.role)
                        .map((r) => (
                          <button
                            key={r}
                            type="button"
                            className="cb-chip"
                            onClick={() => void changeRole(s.user_id, r)}
                          >
                            Make {ROLE_LABEL[r]}
                          </button>
                        ))}
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
