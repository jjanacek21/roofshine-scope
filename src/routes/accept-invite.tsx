import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { lookupCompanyInvite, acceptCompanyInvite } from "@/lib/company-invite.functions";

/**
 * One-step invite acceptance for the main app.
 *
 * Everything happens here: the account is created (or an existing one is
 * confirmed and given a new password), the profile is attached to the company,
 * and the invite is marked used — then we sign in. No confirmation email in the
 * middle, because the invite arriving at that address is the proof of ownership.
 *
 * Claim Buddy invites went out with this same path before /cb/accept existed, so
 * a token this page cannot find is handed over there rather than dead-ending.
 */
export const Route = createFileRoute("/accept-invite")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const inviteQuery = useQuery({
    queryKey: ["company-invite", token],
    enabled: !!token,
    retry: false,
    queryFn: () => lookupCompanyInvite({ data: { token } }),
  });

  const invite = inviteQuery.data;

  // Not one of ours — it is almost certainly a Claim Buddy invite on the old path.
  useEffect(() => {
    if (invite && !invite.ok && invite.reason === "missing") {
      navigate({ to: "/cb/accept", search: { token }, replace: true });
    }
  }, [invite, token, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!invite?.ok) return;
    if (password.length < 8) {
      toast.error("Pick a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const result = await acceptCompanyInvite({
        data: {
          token,
          password,
          ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
          ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
        },
      });

      const { error } = await supabase.auth.signInWithPassword({
        email: result.email,
        password,
      });
      if (error) throw error;

      toast.success(`You're in — welcome to ${result.company}`);
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't accept the invite");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-5 py-10"
      style={{
        background:
          "radial-gradient(ellipse at top, rgba(30,144,255,.15), transparent 50%), radial-gradient(ellipse at bottom right, rgba(212,165,116,.08), transparent 60%), var(--bg)",
      }}
    >
      <div
        className="relative w-full max-w-[420px] p-10"
        style={{
          background: "linear-gradient(180deg, var(--bg-card), #111114)",
          border: "1px solid var(--border-bright)",
          borderRadius: 20,
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="mb-8">
          <Logo size="lg" platform />
        </div>

        {!token ? (
          <Message title="This link is missing its invite code." />
        ) : inviteQuery.isLoading ? (
          <Message title="Checking your invite…" />
        ) : inviteQuery.isError ? (
          <Message
            title="We couldn't check that invite."
            body="Try the link again in a moment, or ask your admin to resend it."
          />
        ) : !invite?.ok ? (
          <Message
            title={
              invite?.reason === "accepted"
                ? "This invite was already used."
                : invite?.reason === "expired"
                  ? "This invite has expired."
                  : "Looking for that invite…"
            }
            body={
              invite?.reason === "accepted"
                ? "Sign in with the email it was sent to."
                : invite?.reason === "expired"
                  ? "Ask your admin to send a new one."
                  : undefined
            }
            action={
              invite?.reason === "accepted" || invite?.reason === "expired"
                ? { label: "Go to sign in", onClick: () => navigate({ to: "/login" }) }
                : undefined
            }
          />
        ) : (
          <>
            <p
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Invitation
            </p>
            <h1
              className="mt-1 font-bold text-foreground"
              style={{ fontSize: 24, letterSpacing: "-0.5px" }}
            >
              Join {invite.company}
            </h1>
            <p className="mb-6 mt-1.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
              {invite.email} · {invite.role}
            </p>

            {invite.hasAccount && (
              <div
                className="mb-5 rounded-lg p-3 text-xs"
                style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
              >
                You already started an account with this address. Setting a password here finishes
                it and gets you straight in — no confirmation email needed.
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <Field
                label="First name"
                value={firstName}
                onChange={setFirstName}
                autoComplete="given-name"
              />
              <Field
                label="Last name"
                value={lastName}
                onChange={setLastName}
                autoComplete="family-name"
              />
              <Field
                label={invite.hasAccount ? "Set your password" : "Choose a password"}
                value={password}
                onChange={setPassword}
                type="password"
                autoComplete="new-password"
                hint="At least 8 characters"
              />

              <button
                type="submit"
                disabled={busy || password.length < 8}
                className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}
              >
                {busy ? "Setting up…" : `Join ${invite.company}`}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Message({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div>
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      {body && (
        <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
          {body}
        </p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 rounded-lg border px-4 py-2 text-sm font-semibold text-foreground"
          style={{ borderColor: "var(--border-bright)" }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg px-3.5 py-3 text-sm text-foreground outline-none"
        style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
      />
      {hint && (
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {hint}
        </span>
      )}
    </div>
  );
}
