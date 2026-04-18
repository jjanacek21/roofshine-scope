import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/brand/Logo";
import { TRADES, type Trade } from "@/lib/trades";
import { Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

const STEPS = [
  { n: 1, label: "Account" },
  { n: 2, label: "Company" },
  { n: 3, label: "Trades" },
];

function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(2);
  const [companyName, setCompanyName] = useState("");
  const [markup, setMarkup] = useState("20");
  const [overhead, setOverhead] = useState("10");
  const [profit, setProfit] = useState("10");
  const [licenses, setLicenses] = useState("");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [authLoading, user, navigate]);

  function onCompanySubmit(e: FormEvent) {
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
        trades,
        default_markup: Number(markup) || 0,
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
    <div
      className="flex min-h-screen items-center justify-center px-5 py-10"
      style={{
        background:
          "radial-gradient(ellipse at top right, rgba(30,144,255,.12), transparent 50%), var(--bg)",
      }}
    >
      <div
        className="w-full max-w-[640px] p-10"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-bright)",
          borderRadius: 20,
        }}
      >
        {/* Steps */}
        <div className="mb-8 flex items-center gap-3">
          {STEPS.map((s, i) => {
            const done = step > s.n;
            const active = step === s.n;
            return (
              <div key={s.n} className="flex items-center gap-3">
                <div className="flex items-center gap-2.5 text-xs font-semibold">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
                    style={{
                      background: done
                        ? "var(--success)"
                        : active
                          ? "var(--brand)"
                          : "var(--bg)",
                      border: `1px solid ${
                        done
                          ? "var(--success)"
                          : active
                            ? "var(--brand)"
                            : "var(--border-bright)"
                      }`,
                      color: done || active ? "#fff" : "var(--text-muted)",
                    }}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : s.n}
                  </div>
                  <span
                    style={{
                      color: active || done ? "var(--text)" : "var(--text-muted)",
                    }}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className="h-px w-10"
                    style={{ background: "var(--border)" }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {step === 2 && (
          <form onSubmit={onCompanySubmit}>
            <h2
              className="font-bold text-foreground"
              style={{ fontSize: 24, letterSpacing: "-0.5px" }}
            >
              Tell us about your company
            </h2>
            <p
              className="mt-1.5 text-[13px]"
              style={{ color: "var(--text-muted)" }}
            >
              This will appear on all your proposals and reports
            </p>

            <div className="mt-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-xs font-semibold"
                  style={{ color: "var(--text-dim)" }}
                >
                  Company Name
                </label>
                <input
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="field-input"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-xs font-semibold"
                    style={{ color: "var(--text-dim)" }}
                  >
                    Default Markup %
                  </label>
                  <input
                    type="number"
                    value={markup}
                    onChange={(e) => setMarkup(e.target.value)}
                    className="field-input font-mono-num"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-xs font-semibold"
                    style={{ color: "var(--text-dim)" }}
                  >
                    Overhead %
                  </label>
                  <input
                    type="number"
                    value={overhead}
                    onChange={(e) => setOverhead(e.target.value)}
                    className="field-input font-mono-num"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-xs font-semibold"
                    style={{ color: "var(--text-dim)" }}
                  >
                    Profit %
                  </label>
                  <input
                    type="number"
                    value={profit}
                    onChange={(e) => setProfit(e.target.value)}
                    className="field-input font-mono-num"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  className="text-xs font-semibold"
                  style={{ color: "var(--text-dim)" }}
                >
                  License Numbers (one per line)
                </label>
                <textarea
                  rows={3}
                  value={licenses}
                  onChange={(e) => setLicenses(e.target.value)}
                  placeholder={"CCC1330XXX\nCGC1509XXX"}
                  className="field-input resize-none font-mono-num"
                />
              </div>
            </div>

            <div className="mt-7 flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-ghost h-10 rounded-lg px-4 text-[13px] font-semibold"
              >
                Back
              </button>
              <div className="flex-1" />
              <button
                type="submit"
                className="btn-brand flex h-10 items-center gap-2 rounded-lg px-5 text-[13px] font-semibold"
              >
                Continue
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div>
            <h2
              className="font-bold text-foreground"
              style={{ fontSize: 24, letterSpacing: "-0.5px" }}
            >
              Which trades do you cover?
            </h2>
            <p
              className="mt-1.5 text-[13px]"
              style={{ color: "var(--text-muted)" }}
            >
              Select all that apply — you can change this later in settings
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
                      "flex flex-col items-center gap-2 rounded-lg border p-3 text-xs font-semibold transition-all",
                    )}
                    style={
                      selected
                        ? {
                            backgroundColor: `${t.color}26`,
                            borderColor: t.color,
                            color: t.color,
                          }
                        : {
                            borderColor: "var(--border)",
                            color: "var(--text-dim)",
                            backgroundColor: "var(--bg)",
                          }
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

            <div className="mt-7 flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn-ghost h-10 rounded-lg px-4 text-[13px] font-semibold"
              >
                Back
              </button>
              <div className="flex-1" />
              <button
                type="button"
                disabled={submitting || trades.length === 0 || !companyName}
                onClick={onFinish}
                className="btn-brand h-10 rounded-lg px-5 text-[13px] font-semibold disabled:opacity-60"
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
