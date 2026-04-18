import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [markup, setMarkup] = useState("20");
  const [overhead, setOverhead] = useState("10");
  const [profit, setProfit] = useState("10");
  const [licenses, setLicenses] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [authLoading, user, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .insert({
        name: companyName,
        trades: [],
        default_markup: Number(markup) || 0,
      })
      .select()
      .single();

    if (companyErr || !company) {
      setSubmitting(false);
      toast.error(companyErr?.message ?? "Could not create company");
      return;
    }

    // Preserve super_admin role; otherwise promote to owner
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const updatePayload: { company_id: string; role?: "owner" } =
      existingProfile?.role === "super_admin"
        ? { company_id: company.id }
        : { company_id: company.id, role: "owner" };

    const { error: profileErr } = await supabase
      .from("profiles")
      .update(updatePayload)
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
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[640px] p-10"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-bright)",
          borderRadius: 20,
        }}
      >
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
          You'll upload your Xactimate price book and trade-specific items later.
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
              License Numbers (one per line, optional)
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

        <div className="mt-7 flex justify-end">
          <button
            type="submit"
            disabled={submitting || !companyName}
            className="btn-brand flex h-10 items-center gap-2 rounded-lg px-5 text-[13px] font-semibold disabled:opacity-60"
          >
            {submitting ? "Setting up…" : "Finish setup"}
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
          </button>
        </div>
      </form>
    </div>
  );
}
