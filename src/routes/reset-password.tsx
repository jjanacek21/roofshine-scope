import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash and fires PASSWORD_RECOVERY.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Also check existing session in case the event fired before mount.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated. Please sign in.");
    await supabase.auth.signOut();
    navigate({ to: "/login" });
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
          Set a new password
        </h1>
        <p
          className="mb-7 mt-1.5 text-[13px]"
          style={{ color: "var(--text-muted)" }}
        >
          {ready
            ? "Choose a new password for your account."
            : "Verifying your reset link…"}
        </p>

        {ready && (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-semibold"
                style={{ color: "var(--text-dim)" }}
              >
                New password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-semibold"
                style={{ color: "var(--text-dim)" }}
              >
                Confirm password
              </label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="field-input"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-brand mt-2 h-10 w-full rounded-lg text-[13px] font-semibold"
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}

        <p
          className="mt-7 text-center text-[13px]"
          style={{ color: "var(--text-muted)" }}
        >
          <Link to="/login" className="font-semibold text-[var(--brand)] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
