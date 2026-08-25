import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, type StripeEnv } from "@/lib/stripe.server";
import { CB_PLANS, type CbPlanId } from "@/lib/cbPricing";

const Env = z.enum(["sandbox", "live"]);

const CheckoutInput = z.object({
  workspaceId: z.string().uuid(),
  seats: z.number().int().min(1).max(50),
  returnUrl: z.string().url(),
  environment: Env.default("sandbox"),
});

function planOfId(plan: string): CbPlanId {
  return plan === "basic" || plan === "pro" || plan === "elite" ? plan : "pro";
}

/** Owner-only: start a Stripe subscription checkout for N additional seats. */
export const cbCreateSeatCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CheckoutInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isOwner, error: roleError } = await supabase.rpc("cb_is_owner", {
      _ws: data.workspaceId,
    });
    if (roleError) throw new Error(roleError.message);
    if (!isOwner) throw new Error("Only the workspace owner can buy seats.");

    const { data: ws, error } = await supabase
      .from("cb_workspaces")
      .select("id, name, plan, seats_purchased, stripe_customer_id")
      .eq("id", data.workspaceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ws) throw new Error("Workspace not found");

    const plan = CB_PLANS[planOfId(ws.plan)];
    const unitAmount = Math.round(plan.seatRate * 100);
    const env = data.environment as StripeEnv;
    const stripe = createStripeClient(env);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Claim Buddy ${plan.name} — additional seat`,
              description: `Extra seats for ${ws.name}`,
            },
            unit_amount: unitAmount,
            recurring: { interval: "month" },
          },
          quantity: data.seats,
        },
      ],
      success_url: `${data.returnUrl}?seats=success`,
      cancel_url: `${data.returnUrl}?seats=canceled`,
      ...(ws.stripe_customer_id ? { customer: ws.stripe_customer_id } : {}),
      metadata: {
        workspace_id: ws.id,
        plan: plan.id,
        seats: String(data.seats),
      },
      subscription_data: {
        metadata: {
          workspace_id: ws.id,
          plan: plan.id,
          seats: String(data.seats),
        },
      },
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("cb_seat_purchases").insert({
      workspace_id: ws.id,
      seats: data.seats,
      unit_amount: plan.seatRate,
      plan: plan.id,
      environment: env,
      status: "pending",
      stripe_session_id: session.id,
      created_by: userId,
    });

    return { url: session.url as string | null, sessionId: session.id };
  });

const PortalInput = z.object({
  workspaceId: z.string().uuid(),
  returnUrl: z.string().url(),
  environment: Env.default("sandbox"),
});

/** Owner-only: Stripe billing portal for the workspace's customer. */
export const cbBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PortalInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: isOwner } = await supabase.rpc("cb_is_owner", { _ws: data.workspaceId });
    if (!isOwner) throw new Error("Only the workspace owner can manage billing.");

    const { data: ws } = await supabase
      .from("cb_workspaces")
      .select("stripe_customer_id")
      .eq("id", data.workspaceId)
      .maybeSingle();

    if (!ws?.stripe_customer_id) {
      throw new Error("No billing account yet — buy seats first and the portal turns on.");
    }

    const stripe = createStripeClient(data.environment as StripeEnv);
    const session = await stripe.billingPortal.sessions.create({
      customer: ws.stripe_customer_id,
      return_url: data.returnUrl,
    });

    return { url: session.url };
  });
