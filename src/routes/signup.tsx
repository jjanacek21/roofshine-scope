import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/onboarding`,
        data: { first_name: firstName, last_name: lastName },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created — check your email to confirm");
    navigate({ to: "/onboarding" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div
        className="w-full max-w-md rounded-xl border p-8 shadow-lg"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--surface)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-center text-2xl font-bold text-foreground">Create account</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Get started with BuildScopeAI
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                First name
              </label>
              <input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border bg-[var(--surface-elevated)] px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Last name
              </label>
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border bg-[var(--surface-elevated)] px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border bg-[var(--surface-elevated)] px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border bg-[var(--surface-elevated)] px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-brand h-10 w-full rounded-md text-sm font-semibold disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-[var(--brand)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
