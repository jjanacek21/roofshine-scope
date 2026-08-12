import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CbAuthShell } from "@/components/claim-buddy/CbAuthShell";
import { CbButton } from "@/components/cb/primitives";
import { CbField, focusFirstError } from "@/components/cb/forms";

export const Route = createFileRoute("/cb/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Claim Buddy" },
      {
        name: "description",
        content:
          "Sign in to Claim Buddy to run roof inspections, build damage reports, and get agreements signed in the field.",
      },
      { property: "og:title", content: "Sign in — Claim Buddy" },
      {
        property: "og:description",
        content: "Field inspection and insurance-restoration tooling for roofing contractors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbLoginPage,
});

function CbLoginPage() {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    const next: typeof errors = {};
    if (!email.includes("@")) next.email = "That doesn't look like an email address yet.";
    if (password.length < 6) next.password = "Passwords are at least 6 characters.";
    setErrors(next);
    if (Object.keys(next).length) {
      requestAnimationFrame(() => focusFirstError(formRef.current));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErrors({ password: "We couldn't sign you in with those details." });
      requestAnimationFrame(() => focusFirstError(formRef.current));
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/cb" });
  }

  return (
    <CbAuthShell title="Welcome back" subtitle="Sign in to your Claim Buddy account">
      <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
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
          autoComplete="current-password"
          value={password}
          error={errors.password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-xs font-semibold hover:underline"
            style={{ color: "var(--cb-accent-deep)" }}
          >
            Forgot password?
          </Link>
        </div>
        <CbButton type="submit" block loading={loading} loadingText="Signing in…">
          Sign in
        </CbButton>
      </form>

      <p className="mt-7 text-center text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
        New to Claim Buddy?{" "}
        <Link
          to="/cb/signup"
          className="font-semibold hover:underline"
          style={{ color: "var(--cb-accent-deep)" }}
        >
          Create an account
        </Link>
      </p>
    </CbAuthShell>
  );
}
