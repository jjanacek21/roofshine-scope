import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, Building2, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  validateSearch: (search: Record<string, unknown>) => ({
    invite: typeof search.invite === "string" ? search.invite : undefined,
  }),
  component: OnboardingPage,
});

type Mode = "create" | "join";

function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const { invite: inviteToken } = useSearch({ from: "/onboarding" });
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>(inviteToken ? "join" : "create");
  const [token, setToken] = useState(inviteToken ?? "");
  const [companyName, setCompanyName] = useState("");
  const [markup, setMarkup] = useState("20");
  const [overhead, setOverhead] = useState("10");
  const [profit, setProfit] = useState("10");
  const [licenses, setLicenses] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [invitePreview, setInvitePreview] = useState<{
    company_name: string;
    role: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [authLoading, user, navigate]);

  // Look up the invite preview if we got a token in the URL
  useEffect(() => {
    if (!inviteToken) return;
    (async () => {
      const { data } = await supabase.rpc("get_invite_preview", {
        _token: inviteToken,
      });
      if (data && (data as { valid: boolean }).valid) {
        setInvitePreview(data as { company_name: string; role: string; email: string; valid: boolean });
      } else {
        toast.error("This invite link is invalid or expired");
      }
    })();
  }, [inviteToken]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .insert({
        name: companyName,
        trades: [],
        default_markup: Number(markup) || 0,
      })
      .select()
      .single();

    if (companyErr || !company) {
      setSubmitting(false);
      toast.error(companyErr?.message ?? "Could not create company");
      return;
    }

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const updatePayload: { company_id: string; role?: "owner" } =
      existingProfile?.role === "super_admin"
        ? { company_id: company.id }
        : { company_id: company.id, role: "owner" };

    const { error: profileErr } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id);

    setSubmitting(false);
    if (profileErr) {
      toast.error(profileErr.message);
      return;
    }
    toast.success("Welcome to BuildScopeAI");
    navigate({ to: "/" });
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("accept_company_invite", {
      _token: token.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { company_name: string };
    toast.success(`Joined ${result.company_name}`);
    navigate({ to: "/" });
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-5 py-10"
      style={{
        background:
          "radial-gradient(ellipse at top right, rgba(30,144,255,.12), transparent 50%), var(--bg)",
      }}
    >
      <div
        className="w-full max-w-[640px] p-10"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-bright)",
          borderRadius: 20,
        }}
      >
        {/* Mode toggle */}
        <div className="mb-6 flex gap-1 rounded-lg p-1" style={{ background: "var(--bg-hover)" }}>
          <button
            type="button"
            onClick={() => setMode("create")}
            className="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            style={{
              background: mode === "create" ? "var(--bg-card)" : "transparent",
              color: mode === "create" ? "var(--text)" : "var(--text-dim)",
            }}
          >
            <Building2 className="h-4 w-4" /> Create company
          </button>
          <button
            type="button"
            onClick={() => setMode("join")}
            className="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            style={{
              background: mode === "join" ? "var(--bg-card)" : "transparent",
              color: mode === "join" ? "var(--text)" : "var(--text-dim)",
            }}
          >
            <UserPlus className="h-4 w-4" /> Join with invite
          </button>
        </div>

        {mode === "create" ? (
          <form onSubmit={onCreate}>
            <h2 className="font-bold text-foreground" style={{ fontSize: 24, letterSpacing: "-0.5px" }}>
              Tell us about your company
            </h2>
            <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
              You'll upload your Xactimate price book and trade-specific items later.
            </p>

            <div className="mt-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                  Company Name
                </label>
                <input
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="field-input"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                    Default Markup %
                  </label>
                  <input
                    type="number"
                    value={markup}
                    onChange={(e) => setMarkup(e.target.value)}
                    className="field-input font-mono-num"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                    Overhead %
                  </label>
                  <input
                    type="number"
                    value={overhead}
                    onChange={(e) => setOverhead(e.target.value)}
                    className="field-input font-mono-num"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                    Profit %
                  </label>
                  <input
                    type="number"
                    value={profit}
                    onChange={(e) => setProfit(e.target.value)}
                    className="field-input font-mono-num"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                  License Numbers (one per line, optional)
                </label>
                <textarea
                  rows={3}
                  value={licenses}
                  onChange={(e) => setLicenses(e.target.value)}
                  placeholder={"CCC1330XXX\nCGC1509XXX"}
                  className="field-input resize-none font-mono-num"
                />
              </div>
            </div>

            <div className="mt-7 flex justify-end">
              <button
                type="submit"
                disabled={submitting || !companyName}
                className="btn-brand flex h-10 items-center gap-2 rounded-lg px-5 text-[13px] font-semibold disabled:opacity-60"
              >
                {submitting ? "Setting up…" : "Finish setup"}
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={onJoin}>
            <h2 className="font-bold text-foreground" style={{ fontSize: 24, letterSpacing: "-0.5px" }}>
              Join your team
            </h2>
            <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
              Paste the invite token from your invitation link or email.
            </p>

            {invitePreview && (
              <div
                className="mt-5 rounded-lg p-4 text-sm"
                style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}
              >
                <p className="text-foreground">
                  You're joining <span className="font-semibold">{invitePreview.company_name}</span> as{" "}
                  <span className="font-semibold">{invitePreview.role}</span>.
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  Make sure you signed up with <span className="font-mono">{invitePreview.email}</span>.
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                Invite Token
              </label>
              <input
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste invite token"
                className="field-input font-mono-num"
              />
            </div>

            <div className="mt-7 flex justify-end">
              <button
                type="submit"
                disabled={submitting || !token}
                className="btn-brand flex h-10 items-center gap-2 rounded-lg px-5 text-[13px] font-semibold disabled:opacity-60"
              >
                {submitting ? "Joining…" : "Accept invite"}
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
