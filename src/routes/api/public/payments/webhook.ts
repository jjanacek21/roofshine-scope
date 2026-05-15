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

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
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
