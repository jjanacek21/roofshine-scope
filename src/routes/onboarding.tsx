import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/brand/Logo";
import { TRADES, type Trade } from "@/lib/trades";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [authLoading, user, navigate]);

  async function onCompanySubmit(e: FormEvent) {
    e.preventDefault();
    setStep(3);
  }

  function toggleTrade(t: Trade) {
    setTrades((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  async function onFinish() {
    if (!user) return;
    setSubmitting(true);
    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .insert({
        name: companyName,
        phone,
        address,
        trades,
      })
      .select()
      .single();

    if (companyErr || !company) {
      setSubmitting(false);
      toast.error(companyErr?.message ?? "Could not create company");
      return;
    }

    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ company_id: company.id, role: "owner" })
      .eq("id", user.id);

    setSubmitting(false);
    if (profileErr) {
      toast.error(profileErr.message);
      return;
    }
    toast.success("Welcome to BuildScopeAI");
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div
        className="w-full max-w-2xl rounded-xl border p-8"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--surface)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        {/* Steps */}
        <div className="mb-8 flex items-center justify-center gap-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                  step >= n
                    ? "text-white"
                    : "bg-[var(--surface-elevated)] text-muted-foreground",
                )}
                style={step >= n ? { background: "var(--gradient-brand)" } : undefined}
              >
                {step > n ? <Check className="h-4 w-4" /> : n}
              </div>
              {n < 3 && (
                <div
                  className="h-0.5 w-12"
                  style={{
                    backgroundColor:
                      step > n ? "var(--brand)" : "var(--surface-hover)",
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">Account ready</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Welcome, {user?.email}. Let's set up your company.
            </p>
            <button
              onClick={() => setStep(2)}
              className="btn-brand mt-6 h-10 rounded-md px-6 text-sm font-semibold"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={onCompanySubmit} className="space-y-4">
            <h2 className="text-center text-2xl font-bold text-foreground">
              Tell us about your company
            </h2>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Company name
              </label>
              <input
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border bg-[var(--surface-elevated)] px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Phone
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border bg-[var(--surface-elevated)] px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Business address
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border bg-[var(--surface-elevated)] px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
            <button
              type="submit"
              className="btn-brand h-10 w-full rounded-md text-sm font-semibold"
            >
              Continue to trades
            </button>
          </form>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-center text-2xl font-bold text-foreground">
              Which trades do you cover?
            </h2>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Select all that apply — you can change this later.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {TRADES.map((t) => {
                const selected = trades.includes(t.value);
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => toggleTrade(t.value)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border p-3 text-xs font-medium transition-all",
                      selected
                        ? "border-transparent text-foreground"
                        : "text-muted-foreground hover:bg-[var(--surface-hover)]",
                    )}
                    style={
                      selected
                        ? {
                            backgroundColor: `${t.color}1f`,
                            borderColor: `${t.color}80`,
                            color: t.color,
                          }
                        : { borderColor: "var(--border)" }
                    }
                  >
                    <span
                      className="h-3 w-3 rounded-sm"
                      style={{ backgroundColor: t.color }}
                    />
                    {t.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn-chrome h-10 flex-1 rounded-md text-sm font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                disabled={submitting || trades.length === 0 || !companyName}
                onClick={onFinish}
                className="btn-brand h-10 flex-1 rounded-md text-sm font-semibold disabled:opacity-60"
              >
                {submitting ? "Setting up…" : "Finish setup"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
