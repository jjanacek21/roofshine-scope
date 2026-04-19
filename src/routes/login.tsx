import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
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
    navigate({ to: "/" });
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
          <Logo size="lg" />
        </div>

        <h1
          className="font-bold text-foreground"
          style={{ fontSize: 24, letterSpacing: "-0.5px" }}
        >
          Welcome back
        </h1>
        <p
          className="mb-7 mt-1.5 text-[13px]"
          style={{ color: "var(--text-muted)" }}
        >
          Sign in to your workspace to continue
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs font-semibold"
              style={{ color: "var(--text-dim)" }}
            >
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
              <label
                className="text-xs font-semibold"
                style={{ color: "var(--text-dim)" }}
              >
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

        <p
          className="mt-7 text-center text-[13px]"
          style={{ color: "var(--text-muted)" }}
        >
          Don't have an account?{" "}
          <Link to="/signup" className="font-semibold text-[var(--brand)] hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
