import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CbAdminShell } from "@/components/cb/CbAdminShell";
import { CbCard, CbButton, CbBadge, CbSkeleton } from "@/components/cb/primitives";
import { CbStepper } from "@/components/cb/forms";
import { useCbSession } from "@/components/auth/CbSessionProvider";
import { cbBillingPortal, cbCreateSeatCheckout } from "@/lib/cb-billing.functions";
import {
  CB_MAX_SEATS,
  CB_PLANS,
  money,
  planOf,
  quoteSeats,
  seatRateLabel,
  type CbPlanId,
} from "@/lib/cbPricing";

export const Route = createFileRoute("/cb/admin/seats")({
  head: () => ({
    meta: [
      { title: "Seats & billing — Claim Buddy admin" },
      {
        name: "description",
        content:
          "See how many Claim Buddy seats you're using, what an extra seat costs on your plan, and buy more seats with a card.",
      },
      { property: "og:title", content: "Seats & billing — Claim Buddy admin" },
      {
        property: "og:description",
        content: "Seat usage, extra-seat pricing and card checkout for your Claim Buddy company.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbAdminSeatsPage,
});

type SeatsPayload = {
  seats_purchased: number;
  seats_used: number;
  seats_pending: number;
};

function planId(plan: string | null | undefined): CbPlanId {
  return plan === "basic" || plan === "pro" || plan === "elite" ? plan : "pro";
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
        {label}
      </span>
      <span className={strong ? "cb-num text-[16px] font-bold" : "cb-num text-[14px]"}>{value}</span>
    </div>
  );
}

function CbAdminSeatsPage() {
  const { workspace } = useCbSession();
  const qc = useQueryClient();
  const [add, setAdd] = useState(1);
  const [busy, setBusy] = useState(false);

  const isOwner = workspace?.role === "owner";
  const isLeader = isOwner || workspace?.role === "admin";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const status = new URLSearchParams(window.location.search).get("seats");
    if (status === "success") {
      toast.success("Payment received — your new seats are being switched on.");
      void qc.invalidateQueries();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (status === "canceled") {
      toast.info("Checkout canceled — nothing was charged.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [qc]);

  const seatsQuery = useQuery({
    queryKey: ["cb-seats", workspace?.id],
    enabled: !!workspace?.id && isLeader,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cb_seats", { _ws: workspace!.id });
      if (error) throw error;
      return (data ?? {}) as unknown as SeatsPayload;
    },
  });

  const wsQuery = useQuery({
    queryKey: ["cb-ws-billing", workspace?.id],
    enabled: !!workspace?.id && isLeader,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cb_workspaces")
        .select("id, plan, billing_status, trial_ends_at, seats_purchased, stripe_customer_id")
        .eq("id", workspace!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const historyQuery = useQuery({
    queryKey: ["cb-seat-purchases", workspace?.id],
    enabled: !!workspace?.id && isLeader,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cb_seat_purchases")
        .select("id, seats, unit_amount, status, created_at")
        .eq("workspace_id", workspace!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const plan = planOf(planId(wsQuery.data?.plan));
  const purchased = seatsQuery.data?.seats_purchased ?? wsQuery.data?.seats_purchased ?? 0;
  const used = seatsQuery.data?.seats_used ?? 0;
  const pending = seatsQuery.data?.seats_pending ?? 0;
  const remaining = Math.max(0, purchased - used - pending);
  const pct = purchased > 0 ? Math.min(100, Math.round(((used + pending) / purchased) * 100)) : 0;

  const current = quoteSeats(Math.max(purchased, plan.minSeats), plan.id);
  const next = quoteSeats(Math.max(purchased, plan.minSeats) + add, plan.id);
  const delta = Math.max(0, next.recurring - current.recurring);

  const trialEnds = wsQuery.data?.trial_ends_at ? new Date(wsQuery.data.trial_ends_at) : null;
  const onTrial = !!trialEnds && trialEnds.getTime() > Date.now();

  async function buy() {
    if (!workspace) return;
    setBusy(true);
    try {
      const res = await cbCreateSeatCheckout({
        data: {
          workspaceId: workspace.id,
          seats: add,
          returnUrl: `${window.location.origin}/cb/admin/seats`,
          environment: "sandbox",
        },
      });
      if (res.url) window.location.href = res.url;
      else toast.error("Stripe didn't return a checkout link. Try again.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start checkout");
    } finally {
      setBusy(false);
    }
  }

  async function openPortal() {
    if (!workspace) return;
    setBusy(true);
    try {
      const res = await cbBillingPortal({
        data: {
          workspaceId: workspace.id,
          returnUrl: `${window.location.origin}/cb/admin/seats`,
          environment: "sandbox",
        },
      });
      window.location.href = res.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open billing");
    } finally {
      setBusy(false);
    }
  }

  const loading = seatsQuery.isLoading || wsQuery.isLoading;

  return (
    <CbAdminShell title="Seats & billing" subtitle="What you're paying for, and how to add more people.">
      <div className="space-y-5">
        {/* Plan */}
        <CbCard elevation="raised" style={{ padding: 18 }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="cb-microlabel">Plan</p>
              <p className="mt-1 text-[20px] font-bold">{plan.name}</p>
            </div>
            <CbBadge tone={onTrial ? "accent" : "success"}>
              {onTrial ? `Trial ends ${trialEnds!.toLocaleDateString()}` : wsQuery.data?.billing_status ?? "active"}
            </CbBadge>
          </div>
          <p className="mt-2 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
            {plan.blurb}
          </p>
          <p className="mt-2 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
            {seatRateLabel(purchased, plan.id)}
          </p>
        </CbCard>

        {/* Usage */}
        <CbCard elevation="card" style={{ padding: 18 }}>
          <p className="cb-microlabel">Seats in use</p>
          {loading ? (
            <CbSkeleton className="mt-3 h-8 w-40" />
          ) : (
            <>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4">
                <span className="cb-num" style={{ fontSize: 30, fontWeight: 700 }}>
                  {used}/{purchased}
                </span>
                <span className="text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                  {pending ? `${pending} invited · ` : ""}
                  {remaining} open
                </span>
              </div>
              <div
                className="mt-3 h-2 w-full overflow-hidden rounded-full"
                style={{ background: "var(--cb-border)" }}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--cb-accent)" }} />
              </div>
            </>
          )}
        </CbCard>

        {/* Cost breakdown */}
        <CbCard elevation="card" style={{ padding: 18 }}>
          <p className="cb-microlabel">What you pay today</p>
          <div className="mt-2">
            {plan.base > 0 ? (
              <Row label={`${plan.name} base (${plan.includedSeats} seats included)`} value={`${money(plan.base)}/mo`} />
            ) : null}
            <Row
              label={`${current.extraSeats} extra seat${current.extraSeats === 1 ? "" : "s"} × ${money(plan.seatRate)}`}
              value={`${money(current.extraSeatCost)}/mo`}
            />
            <div className="my-1 h-px w-full" style={{ background: "var(--cb-border)" }} />
            <Row label="Monthly total" value={`${money(current.recurring)}/mo`} strong />
          </div>
        </CbCard>

        {/* Buy seats */}
        <CbCard elevation="raised" style={{ padding: 18 }}>
          <p className="cb-microlabel">Add seats</p>
          <div className="mt-3">
            <CbStepper
              label="Seats to add"
              value={add}
              onChange={(v) => setAdd(Math.max(1, Math.min(CB_MAX_SEATS, Math.round(v))))}
              min={1}
              max={CB_MAX_SEATS}
            />
          </div>
          <div className="mt-3">
            <Row label={`${add} seat${add === 1 ? "" : "s"} × ${money(plan.seatRate)}/mo`} value={`+${money(delta)}/mo`} />
            <Row label="New monthly total" value={`${money(next.recurring)}/mo`} strong />
          </div>
          {isOwner ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <CbButton size="lg" onClick={buy} disabled={busy}>
                {busy ? "Opening checkout…" : "Continue to checkout"}
              </CbButton>
              {wsQuery.data?.stripe_customer_id ? (
                <CbButton size="lg" variant="secondary" onClick={openPortal} disabled={busy}>
                  Manage billing
                </CbButton>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
              Only the workspace owner can buy seats. Ask them to add {add} more.
            </p>
          )}
          <p className="mt-3 text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
            Seats switch on as soon as the payment clears. Nothing changes if you cancel checkout.
          </p>
        </CbCard>

        {/* History */}
        <CbCard elevation="card" style={{ padding: 18 }}>
          <p className="cb-microlabel">Seat purchases</p>
          {historyQuery.isLoading ? (
            <CbSkeleton className="mt-3 h-10 w-full" />
          ) : (historyQuery.data ?? []).length === 0 ? (
            <p className="mt-2 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
              No seat purchases yet.
            </p>
          ) : (
            <ul className="mt-2 divide-y" style={{ borderColor: "var(--cb-border)" }}>
              {(historyQuery.data ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <span className="text-[13.5px]">
                    +{p.seats} seat{p.seats === 1 ? "" : "s"} ·{" "}
                    <span style={{ color: "var(--cb-text-muted)" }}>
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </span>
                  <CbBadge tone={p.status === "paid" ? "success" : "neutral"}>{p.status}</CbBadge>
                </li>
              ))}
            </ul>
          )}
        </CbCard>

        <p className="text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
          Plans: {CB_PLANS.basic.name} {money(CB_PLANS.basic.seatRate)}/user/mo · {CB_PLANS.pro.name}{" "}
          {money(CB_PLANS.pro.base)}/mo with {CB_PLANS.pro.includedSeats} seats · {CB_PLANS.elite.name}{" "}
          {money(CB_PLANS.elite.base)}/mo with {CB_PLANS.elite.includedSeats} seats.
        </p>
      </div>
    </CbAdminShell>
  );
}
