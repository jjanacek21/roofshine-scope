import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, type StripeEnv } from "@/lib/stripe.server";

export const createInvoiceCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      invoice_id: z.string().uuid(),
      amount: z.number().positive(),
      return_url: z.string().url(),
      environment: z.enum(["sandbox", "live"]),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("id, company_id, invoice_number, customer_email, customer_name, currency, amount_due")
      .eq("id", data.invoice_id)
      .single();
    if (error || !invoice) throw new Error("Invoice not found");

    const env = data.environment as StripeEnv;
    const stripe = createStripeClient(env);

    const amountInCents = Math.round(data.amount * 100);

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: (invoice.currency || "usd").toLowerCase(),
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: invoice.customer_name
                ? `Payment from ${invoice.customer_name}`
                : undefined,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: data.return_url,
      payment_method_types: ["card", "link", "us_bank_account"],
      ...(invoice.customer_email && { customer_email: invoice.customer_email }),
      metadata: {
        invoice_id: invoice.id,
        company_id: invoice.company_id,
      },
    });

    await supabase.from("invoice_payment_intents").insert({
      invoice_id: invoice.id,
      company_id: invoice.company_id,
      provider: "stripe",
      provider_session_id: session.id,
      amount: data.amount,
      environment: env,
      status: "pending",
    });

    return { client_secret: session.client_secret };
  });

// Public version — no auth, uses public_pay_token
export const createPublicInvoiceCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      pay_token: z.string().min(10),
      amount: z.number().positive(),
      return_url: z.string().url(),
      environment: z.enum(["sandbox", "live"]),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    // Use admin client to look up invoice by token (public flow)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invoice, error } = await supabaseAdmin
      .from("invoices")
      .select("id, company_id, invoice_number, customer_email, customer_name, currency, amount_due, status")
      .eq("public_pay_token", data.pay_token)
      .single();
    if (error || !invoice) throw new Error("Invoice not found");
    if (invoice.status === "void") throw new Error("Invoice has been voided");
    if (invoice.status === "paid") throw new Error("Invoice already paid");

    const env = data.environment as StripeEnv;
    const stripe = createStripeClient(env);
    const amountInCents = Math.round(data.amount * 100);

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: (invoice.currency || "usd").toLowerCase(),
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: invoice.customer_name
                ? `Payment from ${invoice.customer_name}`
                : undefined,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: data.return_url,
      payment_method_types: ["card", "link", "us_bank_account"],
      ...(invoice.customer_email && { customer_email: invoice.customer_email }),
      metadata: {
        invoice_id: invoice.id,
        company_id: invoice.company_id,
      },
    });

    await supabaseAdmin.from("invoice_payment_intents").insert({
      invoice_id: invoice.id,
      company_id: invoice.company_id,
      provider: "stripe",
      provider_session_id: session.id,
      amount: data.amount,
      environment: env,
      status: "pending",
    });

    return { client_secret: session.client_secret };
  });
