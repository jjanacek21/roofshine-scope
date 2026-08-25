import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

/** Seat subscriptions bought from the Claim Buddy admin portal. */
async function handleSeatCheckout(session: any, env: StripeEnv): Promise<boolean> {
  const workspaceId = session.metadata?.workspace_id;
  if (!workspaceId) return false;

  const supabase = getSupabase() as any;
  const seats = Number(session.metadata?.seats ?? 0);
  if (!Number.isFinite(seats) || seats < 1) return true;

  const { data: purchase } = await supabase
    .from("cb_seat_purchases")
    .select("id, status")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (purchase?.status === "paid") return true;

  const { data: ws } = await supabase
    .from("cb_workspaces")
    .select("seats_purchased")
    .eq("id", workspaceId)
    .maybeSingle();

  await supabase
    .from("cb_workspaces")
    .update({
      seats_purchased: (ws?.seats_purchased ?? 0) + seats,
      stripe_customer_id: session.customer ?? null,
      stripe_subscription_id: session.subscription ?? null,
      billing_status: "active",
    })
    .eq("id", workspaceId);

  if (purchase) {
    await supabase
      .from("cb_seat_purchases")
      .update({
        status: "paid",
        stripe_subscription_id: session.subscription ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", purchase.id);
  } else {
    await supabase.from("cb_seat_purchases").insert({
      workspace_id: workspaceId,
      seats,
      plan: session.metadata?.plan ?? "pro",
      environment: env,
      status: "paid",
      stripe_session_id: session.id,
      stripe_subscription_id: session.subscription ?? null,
    });
  }

  await supabase.from("cb_audit_log").insert({
    workspace_id: workspaceId,
    action: "seats.purchased",
    meta: { seats, session_id: session.id, environment: env },
  });

  return true;
}

async function handleSubscriptionCanceled(subscription: any) {
  const workspaceId = subscription.metadata?.workspace_id;
  if (!workspaceId) return false;
  const supabase = getSupabase() as any;

  await supabase
    .from("cb_workspaces")
    .update({ billing_status: "canceled" })
    .eq("id", workspaceId);

  await supabase.from("cb_audit_log").insert({
    workspace_id: workspaceId,
    action: "seats.subscription_canceled",
    meta: { subscription_id: subscription.id },
  });
  return true;
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  if (await handleSeatCheckout(session, env)) return;
  const supabase = getSupabase() as any;


  const { data: intent } = await supabase
    .from("invoice_payment_intents")
    .select("*")
    .eq("provider_session_id", session.id)
    .eq("environment", env)
    .maybeSingle();

  const invoiceId = intent?.invoice_id ?? session.metadata?.invoice_id;
  const companyId = intent?.company_id ?? session.metadata?.company_id;
  if (!invoiceId || !companyId) {
    console.error("checkout.session.completed without invoice_id metadata", session.id);
    return;
  }

  const amountPaid = (session.amount_total ?? 0) / 100;

  const { data: existing } = await supabase
    .from("invoice_payments")
    .select("id")
    .eq("provider_id", session.id)
    .maybeSingle();
  if (existing) return;

  await supabase.from("invoice_payments").insert({
    invoice_id: invoiceId,
    company_id: companyId,
    amount: amountPaid,
    method: "stripe",
    status: "succeeded",
    provider_id: session.id,
    provider_meta: {
      payment_intent: session.payment_intent,
      payment_status: session.payment_status,
      customer_email: session.customer_details?.email,
    },
    paid_at: new Date().toISOString(),
  });

  if (intent) {
    await supabase
      .from("invoice_payment_intents")
      .update({ status: "succeeded" })
      .eq("id", intent.id);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook: invalid env", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          const event = await verifyWebhook(request, env);
          switch (event.type) {
            case "checkout.session.completed":
              await handleCheckoutCompleted(event.data.object, env);
              break;
            case "checkout.session.async_payment_succeeded":
              await handleCheckoutCompleted(event.data.object, env);
              break;
            default:
              console.log("Unhandled event:", event.type);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
