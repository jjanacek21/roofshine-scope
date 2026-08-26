import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbLoading } from "@/components/cb/primitives";
import { CbField } from "@/components/cb/forms";
import { cbAcceptInvite, cbLookupInvite } from "@/lib/cb-team.functions";

export const Route = createFileRoute("/cb/accept")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({
    meta: [
      { title: "Accept your Claim Buddy invite" },
      {
        name: "description",
        content: "Set your password and join your company's Claim Buddy workspace.",
      },
      { property: "og:title", content: "Accept your Claim Buddy invite" },
      { property: "og:description", content: "Join your company's Claim Buddy workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CbAcceptPage,
});

function CbAcceptPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const inviteQuery = useQuery({
    queryKey: ["cb-invite", token],
    enabled: !!token,
    queryFn: () => cbLookupInvite({ data: { token } }),
  });

  async function accept() {
    const invite = inviteQuery.data;
    if (!invite?.ok) return;
    if (!invite.hasAccount && password.length < 8) {
      toast.error("Pick a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await cbAcceptInvite({
        data: {
          token,
          ...(password ? { password } : {}),
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
        },
      });
      if (password) {
        const { error } = await supabase.auth.signInWithPassword({ email: invite.email, password });
        if (error) throw error;
        /* An owner's next job is the logo and colours that go on every report.
           A rep's is the dashboard. Sending both to the dashboard left owners
           hunting through settings for the one thing they came to do. */
        navigate({ to: invite.role === "owner" ? "/cb/admin/branding" : "/cb" });
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

  const invite = inviteQuery.data;

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
              {invite.email} · {invite.role} · no plan or payment needed
            </p>

            {invite.isComp ? (
              <div
                className="mt-4 rounded-[12px] px-3.5 py-3 text-[13px]"
                style={{
                  background: "var(--cb-surface-sunken, rgba(21,128,61,.08))",
                  border: "1px solid var(--cb-hairline, rgba(21,128,61,.25))",
                }}
              >
                <strong>Your access is free.</strong> {invite.company} has been set up with full
                Claim Buddy access at no charge — you will not be asked for a card.
              </div>
            ) : null}

            <div className="mt-5 space-y-3">
              {!invite.hasAccount ? (
                <>
                  <CbField label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  <CbField label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  <CbField
                    label="Choose a password"
                    type="password"
                    autoComplete="new-password"
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
