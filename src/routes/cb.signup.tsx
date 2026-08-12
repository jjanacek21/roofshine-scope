import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CbAuthShell } from "@/components/claim-buddy/CbAuthShell";

export const Route = createFileRoute("/cb/signup")({
  head: () => ({
    meta: [
      { title: "Create your account — Claim Buddy" },
      {
        name: "description",
        content:
          "Start using Claim Buddy: roof inspections, photo documentation, damage reports, and signed contingencies from the field.",
      },
      { property: "og:title", content: "Create your account — Claim Buddy" },
      {
        property: "og:description",
        content: "Inspect, document, and present storm damage claims in one mobile workflow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbSignupPage,
});

function CbSignupPage() {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/cb` },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    if (data.session) {
      const { error: bootError } = await supabase.rpc("cb_bootstrap_workspace", {
        _workspace_name: companyName,
        _company: { name: companyName },
      });
      setLoading(false);
      if (bootError) {
        toast.error(bootError.message);
        return;
      }
      toast.success("Workspace created");
      navigate({ to: "/cb" });
      return;
    }

    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <CbAuthShell
        title="Check your email"
        subtitle="We sent a confirmation link. Open it to activate your Claim Buddy account."
      >
        <Link
          to="/cb/login"
          className="btn-brand flex h-10 w-full items-center justify-center rounded-lg text-[13px] font-semibold"
        >
          Back to sign in
        </Link>
      </CbAuthShell>
    );
  }

  return (
    <CbAuthShell title="Create your account" subtitle="Set up your Claim Buddy workspace">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
            Company name
          </label>
          <input
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="field-input"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
            Password
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-brand mt-2 h-10 w-full rounded-lg text-[13px] font-semibold"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>

      <p className="mt-7 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>
        Already have an account?{" "}
        <Link to="/cb/login" className="font-semibold text-[var(--brand)] hover:underline">
          Sign in
        </Link>
      </p>
    </CbAuthShell>
  );
}
