import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public read of an invoice by its public_pay_token (no auth).
export const getPublicInvoice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().min(10) }).parse(input)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invoice, error } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("public_pay_token", data.token)
      .single();
    if (error || !invoice) throw new Error("Invoice not found");

    const [{ data: lines }, { data: payments }, { data: company }, { data: template }] = await Promise.all([
      supabaseAdmin.from("invoice_line_items").select("*").eq("invoice_id", invoice.id).order("sort_order"),
      supabaseAdmin.from("invoice_payments").select("*").eq("invoice_id", invoice.id).eq("status", "succeeded").order("paid_at"),
      supabaseAdmin.from("companies").select("id, name, logo_url, address, phone, email, website, bank_instructions").eq("id", invoice.company_id).single(),
      invoice.template_id
        ? supabaseAdmin.from("invoice_templates").select("*").eq("id", invoice.template_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return {
      invoice,
      lines: lines ?? [],
      payments: payments ?? [],
      company,
      template: template ?? null,
    };
  });
