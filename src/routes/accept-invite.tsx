import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbLoading } from "@/components/cb/primitives";
import { CbField } from "@/components/cb/forms";
import { cbAcceptInvite, cbLookupInvite } from "@/lib/cb-team.functions";

export const Route = createFileRoute("/accept-invite")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({
    meta: [
      { title: "Accept your invite — Claim Buddy" },
      {
        name: "description",
        content:
          "Set your name and password to join your company's Claim Buddy workspace. No plan or company setup required.",
      },
      { property: "og:title", content: "Accept your invite — Claim Buddy" },
      {
        property: "og:description",
        content: "Set your name and password to join your company's Claim Buddy workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const inviteQuery = useQuery({
    queryKey: ["cb-invite", token],
    enabled: !!token,
    queryFn: () => cbLookupInvite({ data: { token } }),
  });

  const invite = inviteQuery.data;

  async function accept() {
    if (!invite?.ok) return;
    const name = fullName.trim();
    if (!invite.hasAccount && name.length < 2) {
      toast.error("Enter your full name.");
      return;
    }
    if (!invite.hasAccount && password.length < 8) {
      toast.error("Pick a password with at least 8 characters.");
      return;
    }
    const [firstName, ...rest] = name.split(/\s+/);
    setBusy(true);
    try {
      await cbAcceptInvite({
        data: {
          token,
          ...(password ? { password } : {}),
          ...(firstName ? { firstName } : {}),
          ...(rest.length ? { lastName: rest.join(" ") } : {}),
        },
      });
      if (password) {
        const { error } = await supabase.auth.signInWithPassword({ email: invite.email, password });
        if (error) throw error;
        navigate({ to: "/cb" });
      } else {
        toast.success("You're on the team — sign in to get started.");
        navigate({ to: "/cb/login" });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't accept the invite");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CbSurface>
      <div className="mx-auto w-full max-w-[520px] px-5 py-12">
        {!token ? (
          <CbCard elevation="card" style={{ padding: 22 }}>
            <p className="text-[15px] font-semibold">This link is missing its invite code.</p>
          </CbCard>
        ) : inviteQuery.isLoading ? (
          <CbLoading label="Checking your invite…" />
        ) : !invite?.ok ? (
          <CbCard elevation="card" style={{ padding: 22 }}>
            <p className="text-[15px] font-semibold">
              {invite?.reason === "accepted"
                ? "This invite was already used."
                : invite?.reason === "expired"
                  ? "This invite has expired."
                  : invite?.reason === "revoked"
                    ? "This invite was revoked."
                    : "We couldn't find that invite."}
            </p>
            <div className="mt-4">
              <CbButton size="md" variant="secondary" onClick={() => navigate({ to: "/cb/login" })}>
                Go to sign in
              </CbButton>
            </div>
          </CbCard>
        ) : (
          <CbCard elevation="raised" style={{ padding: 22 }}>
            <p className="cb-microlabel">Invitation</p>
            <h1 className="cb-display mt-1" style={{ fontSize: 24, lineHeight: 1.15 }}>
              Join {invite.company}
            </h1>
            <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
              {invite.email} · {invite.role} · no plan or company setup needed
            </p>

            <div className="mt-5 space-y-3">
              {!invite.hasAccount ? (
                <>
                  <CbField
                    label="Full name"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                  <CbField
                    label="Password"
                    type="password"
                    autoComplete="new-password"
                    hint="At least 8 characters."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </>
              ) : (
                <p className="text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
                  You already have an account with this email — accepting adds this company to it.
                </p>
              )}
              <CbButton block loading={busy} loadingText="Setting you up…" onClick={() => void accept()}>
                Accept invite
              </CbButton>
            </div>
          </CbCard>
        )}
      </div>
    </CbSurface>
  );
}
