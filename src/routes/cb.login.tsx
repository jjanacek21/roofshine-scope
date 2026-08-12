import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CbAuthShell } from "@/components/claim-buddy/CbAuthShell";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/cb" });
  }

  return (
    <CbAuthShell title="Welcome back" subtitle="Sign in to your Claim Buddy account">
      <form onSubmit={onSubmit} className="space-y-4">
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
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-[var(--brand)] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            required
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
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-7 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>
        New to Claim Buddy?{" "}
        <Link to="/cb/signup" className="font-semibold text-[var(--brand)] hover:underline">
          Create an account
        </Link>
      </p>
    </CbAuthShell>
  );
}
