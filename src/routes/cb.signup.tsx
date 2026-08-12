import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CbAuthShell } from "@/components/claim-buddy/CbAuthShell";
import { CbButton } from "@/components/cb/primitives";
import { CbField, CbProgressRail, focusFirstError } from "@/components/cb/forms";

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

const STEPS = ["Your details", "Confirm email"];

function CbSignupPage() {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ companyName?: string; email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    const next: typeof errors = {};
    if (companyName.trim().length < 2) next.companyName = "Tell us the company name so we can label the workspace.";
    if (!email.includes("@")) next.email = "That doesn't look like an email address yet.";
    if (password.length < 8) next.password = "Use at least 8 characters — it protects your claims.";
    setErrors(next);
    if (Object.keys(next).length) {
      requestAnimationFrame(() => focusFirstError(formRef.current));
      return;
    }

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
        <div className="mb-6">
          <CbProgressRail steps={STEPS} current={1} />
        </div>
        <Link to="/cb/login">
          <CbButton variant="secondary" block>
            Back to sign in
          </CbButton>
        </Link>
      </CbAuthShell>
    );
  }

  return (
    <CbAuthShell title="Create your account" subtitle="Set up your Claim Buddy workspace">
      <div className="mb-6">
        <CbProgressRail steps={STEPS} current={0} />
      </div>
      <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
        <CbField
          label="Company name"
          value={companyName}
          error={errors.companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />
        <CbField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          error={errors.email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <CbField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          error={errors.password}
          hint="At least 8 characters."
          onChange={(e) => setPassword(e.target.value)}
        />
        <CbButton type="submit" block loading={loading} loadingText="Creating…">
          Create account
        </CbButton>
      </form>

      <p className="mt-7 text-center text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
        Already have an account?{" "}
        <Link
          to="/cb/login"
          className="font-semibold hover:underline"
          style={{ color: "var(--cb-accent-deep)" }}
        >
          Sign in
        </Link>
      </p>
    </CbAuthShell>
  );
}
