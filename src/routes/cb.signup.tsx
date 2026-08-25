import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CbAuthShell } from "@/components/claim-buddy/CbAuthShell";
import { CbButton } from "@/components/cb/primitives";
import { CbField, CbProgressRail, focusFirstError } from "@/components/cb/forms";
import { CbSeatPicker } from "@/components/claim-buddy/CbSeatPicker";
import {
  CB_DEFAULT_PLAN,
  CB_PENDING_PLAN_KEY,
  CB_PENDING_SEATS_KEY,
  CB_PLANS,
  CB_TRIAL_DAYS,
  money,
  quoteSeats,
  type CbPlanId,
} from "@/lib/cbPricing";

export const Route = createFileRoute("/cb/signup")({
  head: () => ({
    meta: [
      { title: "Start your free 30-day trial — Claim Buddy" },
      {
        name: "description",
        content:
          "Create your Claim Buddy workspace, pick how many seats your crew needs, and run roof inspections, damage reports, and signed contingencies free for 30 days.",
      },
      { property: "og:title", content: "Start your free 30-day trial — Claim Buddy" },
      {
        property: "og:description",
        content:
          "Basic $19.99/user/mo. Pro $120/mo with 3 seats, $30 per extra seat. Elite $200/mo with 3 seats, $40 per extra seat. Free for 30 days.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbSignupPage,
});

const STEPS = ["Seats", "Your details", "Confirm email"];


function CbSignupPage() {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState<CbPlanId>(CB_DEFAULT_PLAN);
  const [seats, setSeats] = useState(CB_PLANS[CB_DEFAULT_PLAN].minSeats);
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ companyName?: string; email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  /** Set when the typed email matches a pending invite — plan + company are then skipped. */
  const [invite, setInvite] = useState<{ token: string; role: string; company: string } | null>(null);
  const [fullName, setFullName] = useState("");


  const quote = quoteSeats(seats, plan);

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
    // Kept for the email-confirmation path: the workspace is bootstrapped later,
    // after the link is clicked, so the seat choice has to survive the round trip.
    try {
      localStorage.setItem(CB_PENDING_SEATS_KEY, String(quote.seats));
      localStorage.setItem(CB_PENDING_PLAN_KEY, plan);
    } catch {
      /* private mode — seats can still be set in billing settings */
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/cb`, data: { seats: quote.seats, plan } },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    if (data.session) {
      const { data: boot, error: bootError } = await supabase.rpc("cb_bootstrap_workspace", {
        _workspace_name: companyName,
        _company: { name: companyName },
      });
      if (bootError) {
        setLoading(false);
        toast.error(bootError.message);
        return;
      }
      const wsId = (boot as { workspace_id?: string } | null)?.workspace_id;
      if (wsId) {
        await supabase.rpc("cb_set_seats", { _ws: wsId, _seats: quote.seats });
        try {
          localStorage.removeItem(CB_PENDING_SEATS_KEY);
        } catch {
          /* ignore */
        }
      }
      setLoading(false);
      toast.success(`Workspace created — ${CB_TRIAL_DAYS} day trial started`);
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
          <CbProgressRail steps={STEPS} current={2} />
        </div>
        <p className="mb-6 text-[14px]" style={{ color: "var(--cb-text-muted)" }}>
          Your {CB_TRIAL_DAYS}-day free trial starts as soon as you confirm. Nothing is charged until day{" "}
          {CB_TRIAL_DAYS + 1}.
        </p>
        <Link to="/cb/login">
          <CbButton variant="secondary" block>
            Back to sign in
          </CbButton>
        </Link>
      </CbAuthShell>
    );
  }

  if (step === 0) {
    return (
      <CbAuthShell
        title="Start free for 30 days"
        subtitle="Pick your plan and seats — you are not charged until day 31."
      >
        <div className="mb-6">
          <CbProgressRail steps={STEPS} current={0} />
        </div>
        <CbSeatPicker seats={seats} onChange={setSeats} plan={plan} onPlanChange={setPlan} />
        <div className="mt-6">
          <CbButton block onClick={() => setStep(1)}>
            Continue — {money(quote.firstCharge)} after the trial
          </CbButton>
        </div>
        <p className="mt-7 text-center text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
          Already have an account?{" "}
          <Link to="/cb/login" className="font-semibold hover:underline" style={{ color: "var(--cb-accent-deep)" }}>
            Sign in
          </Link>
        </p>
      </CbAuthShell>
    );
  }

  return (
    <CbAuthShell title="Create your account" subtitle="Set up your Claim Buddy workspace">
      <div className="mb-6">
        <CbProgressRail steps={STEPS} current={1} />
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

        <div
          className="rounded-2xl p-4 text-[13px]"
          style={{ background: "var(--cb-surface-2, #f4f7f5)", border: "1px solid var(--cb-border, #e2e8e5)" }}
        >
          <div className="flex items-center justify-between font-semibold">
            <span>{quote.plan.name} · {quote.seats} seats</span>
            <button type="button" className="underline" onClick={() => setStep(0)}>
              Change
            </button>
          </div>
          <div className="mt-1" style={{ color: "var(--cb-text-muted)" }}>
            Free for {CB_TRIAL_DAYS} days, then {money(quote.firstCharge)} on day {CB_TRIAL_DAYS + 1} and{" "}
            {money(quote.recurring)}/mo after. Cancel before day {CB_TRIAL_DAYS + 1} and you pay nothing.
          </div>
        </div>

        <CbButton type="submit" block loading={loading} loadingText="Creating…">
          Start free trial
        </CbButton>
      </form>

      <p className="mt-7 text-center text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
        Already have an account?{" "}
        <Link to="/cb/login" className="font-semibold hover:underline" style={{ color: "var(--cb-accent-deep)" }}>
          Sign in
        </Link>
      </p>
    </CbAuthShell>
  );
}
