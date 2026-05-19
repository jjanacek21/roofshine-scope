import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { toast } from "sonner";
import { Building2, UserPlus, KeyRound } from "lucide-react";

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>) => ({
    invite: typeof search.invite === "string" ? search.invite : undefined,
  }),
  component: SignupPage,
});

type Affiliation = "join" | "create" | "invite";

function SignupPage() {
  const navigate = useNavigate();
  const { invite: urlInvite } = useSearch({ from: "/signup" });
  const [step, setStep] = useState<1 | 2>(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [affiliation, setAffiliation] = useState<Affiliation>(urlInvite ? "invite" : "join");
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [inviteToken, setInviteToken] = useState(urlInvite ?? "");
  const [companySearch, setCompanySearch] = useState("");
  const [invitePreview, setInvitePreview] = useState<{
    company_name: string;
    role: string;
    email: string;
  } | null>(null);
  const [emailLocked, setEmailLocked] = useState(false);

  // Look up invite preview when token comes from URL
  useEffect(() => {
    if (!urlInvite) return;
    (async () => {
      const { data } = await supabase.rpc("get_invite_preview", { _token: urlInvite });
      const preview = data as { valid: boolean; company_name?: string; role?: string; email?: string } | null;
      if (preview && preview.valid && preview.email) {
        setInvitePreview({
          company_name: preview.company_name!,
          role: preview.role!,
          email: preview.email,
        });
        setEmail(preview.email);
        setEmailLocked(true);
      } else {
        toast.error("This invite link is invalid or expired");
      }
    })();
  }, [urlInvite]);

  useEffect(() => {
    if (step !== 2 || affiliation !== "join" || companies.length > 0) return;
    (async () => {
      const { data, error } = await supabase.rpc("list_companies_for_signup");
      if (error) {
        toast.error(error.message);
        return;
      }
      setCompanies((data as { id: string; name: string }[]) ?? []);
    })();
  }, [step, affiliation, companies.length]);


  function nextStep(e: FormEvent) {
    e.preventDefault();
    setStep(2);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (affiliation === "join" && !selectedCompanyId) {
      toast.error("Pick a company to join");
      return;
    }
    if (affiliation === "invite" && !inviteToken.trim()) {
      toast.error("Paste your invite token");
      return;
    }

    setLoading(true);
    const redirectBase = `${window.location.origin}`;
    const emailRedirectTo =
      affiliation === "invite"
        ? `${redirectBase}/onboarding?invite=${encodeURIComponent(inviteToken.trim())}`
        : affiliation === "join"
          ? `${redirectBase}/onboarding?pending=1`
          : `${redirectBase}/onboarding`;

    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: { first_name: firstName, last_name: lastName },
      },
    });

    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    // If session exists immediately (auto-confirm), perform the affiliation action now.
    if (signUpData.session) {
      if (affiliation === "join") {
        const { error: reqErr } = await supabase.rpc("request_to_join_company", {
          _company_id: selectedCompanyId,
        });
        setLoading(false);
        if (reqErr) {
          toast.error(reqErr.message);
          return;
        }
        toast.success("Request sent — waiting for admin approval");
        navigate({ to: "/onboarding", search: { invite: undefined } });
        return;
      }
      if (affiliation === "invite") {
        setLoading(false);
        navigate({ to: "/onboarding", search: { invite: inviteToken.trim() } });
        return;
      }
      setLoading(false);
      navigate({ to: "/onboarding", search: { invite: undefined } });
      return;
    }

    setLoading(false);
    toast.success("Account created — check your email to confirm");
    navigate({ to: "/login" });
  }

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(companySearch.toLowerCase()),
  );

  return (
    <div
      className="flex min-h-screen items-center justify-center px-5 py-10"
      style={{
        background:
          "radial-gradient(ellipse at top, rgba(30,144,255,.15), transparent 50%), radial-gradient(ellipse at bottom right, rgba(212,165,116,.08), transparent 60%), var(--bg)",
      }}
    >
      <div
        className="relative w-full max-w-[460px] p-10"
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

        <h1 className="font-bold text-foreground" style={{ fontSize: 24, letterSpacing: "-0.5px" }}>
          {step === 1 ? "Create your account" : "Where do you work?"}
        </h1>
        <p className="mb-7 mt-1.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
          {step === 1
            ? "Get started with GCN App in under a minute"
            : "Join an existing company, set up a new one, or use an invite"}
        </p>

        {step === 1 ? (
          <form onSubmit={nextStep} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                  First name
                </label>
                <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="field-input" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                  Last name
                </label>
                <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className="field-input" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                Email
              </label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} readOnly={emailLocked} className="field-input" />
              {emailLocked && (
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Email is locked to match your invite.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                Password
              </label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="field-input" />
            </div>
            <button type="submit" className="btn-brand mt-2 h-10 w-full rounded-lg text-[13px] font-semibold">
              Continue
            </button>
          </form>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: "join", label: "Join existing", icon: Building2 },
                { key: "create", label: "Create new", icon: UserPlus },
                { key: "invite", label: "Invite code", icon: KeyRound },
              ] as { key: Affiliation; label: string; icon: typeof Building2 }[]).map((opt) => {
                const Icon = opt.icon;
                const active = affiliation === opt.key;
                return (
                  <button
                    type="button"
                    key={opt.key}
                    onClick={() => setAffiliation(opt.key)}
                    className="flex flex-col items-center gap-1.5 rounded-lg p-3 text-[11px] font-semibold transition-colors"
                    style={{
                      background: active ? "var(--bg-hover)" : "transparent",
                      border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
                      color: active ? "var(--text)" : "var(--text-dim)",
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {affiliation === "join" && (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Search companies…"
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  className="field-input"
                />
                <div
                  className="max-h-56 overflow-y-auto rounded-lg"
                  style={{ border: "1px solid var(--border)" }}
                >
                  {filteredCompanies.length === 0 ? (
                    <div className="p-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      No companies found.
                    </div>
                  ) : (
                    filteredCompanies.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCompanyId(c.id)}
                        className="flex w-full items-center justify-between border-b border-border/50 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
                        style={{
                          background: selectedCompanyId === c.id ? "var(--bg-hover)" : "transparent",
                        }}
                      >
                        <span>{c.name}</span>
                        {selectedCompanyId === c.id && (
                          <span className="text-[10px] font-semibold" style={{ color: "var(--brand)" }}>
                            SELECTED
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Your request will be sent to a company admin for approval.
                </p>
              </div>
            )}

            {affiliation === "create" && (
              <p className="rounded-lg p-3 text-xs" style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>
                You'll set up your company on the next screen after signing in.
              </p>
            )}

            {affiliation === "invite" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                  Invite Token
                </label>
                <input
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  placeholder="Paste invite token"
                  className="field-input font-mono-num"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="h-10 flex-1 rounded-lg text-[13px] font-semibold"
                style={{ background: "var(--bg-hover)", color: "var(--text)" }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-brand h-10 flex-[2] rounded-lg text-[13px] font-semibold disabled:opacity-60"
              >
                {loading ? "Creating account…" : "Create account"}
              </button>
            </div>
          </form>
        )}

        <p className="mt-7 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-[var(--brand)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
