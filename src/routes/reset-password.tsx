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
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 1. Check query string for explicit error params (expired/used links)
      const search = new URLSearchParams(window.location.search);
      const hashRaw = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hash = new URLSearchParams(hashRaw);

      const errorCode =
        search.get("error_code") ||
        search.get("error") ||
        hash.get("error_code") ||
        hash.get("error");
      const errorDesc =
        search.get("error_description") || hash.get("error_description");

      if (errorCode) {
        const msg = errorDesc
          ? decodeURIComponent(errorDesc.replace(/\+/g, " "))
          : "This reset link is invalid or has expired.";
        if (!cancelled) setLinkError(msg);
        return;
      }

      // 2. If hash has tokens, set the session explicitly (don't depend on auto-detect race)
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const type = hash.get("type");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!cancelled) {
          if (error) {
            setLinkError(error.message);
          } else {
            setReady(true);
            // Clean tokens from URL so a refresh doesn't re-process them
            window.history.replaceState(
              null,
              "",
              window.location.pathname
            );
          }
        }
        return;
      }

      // 3. Fallback: maybe the SDK already auto-consumed the hash and stored a session
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        if (data.session) {
          setReady(true);
        } else if (type === "recovery") {
          setLinkError(
            "Reset link could not be verified. Please request a new one."
          );
        } else {
          setLinkError(
            "No active reset session. Please request a new password reset link."
          );
        }
      }
    }

    init();

    // Also listen for late-firing events
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setLinkError(null);
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
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
          <Logo size="lg" platform />
        </div>

        <h1
          className="font-bold text-foreground"
          style={{ fontSize: 24, letterSpacing: "-0.5px" }}
        >
          {linkError ? "Link problem" : "Set a new password"}
        </h1>
        <p
          className="mb-7 mt-1.5 text-[13px]"
          style={{ color: "var(--text-muted)" }}
        >
          {linkError
            ? linkError
            : ready
              ? "Choose a new password for your account."
              : "Verifying your reset link…"}
        </p>

        {linkError && (
          <Link
            to="/forgot-password"
            className="btn-brand mt-2 inline-flex h-10 w-full items-center justify-center rounded-lg text-[13px] font-semibold"
          >
            Request a new link
          </Link>
        )}

        {!linkError && ready && (
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
