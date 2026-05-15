import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const lineItemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(500),
  description: z.string().max(2000).nullish(),
  unit: z.string().max(20).default("EA"),
  qty: z.number().min(0),
  unit_price: z.number(),
  kind: z.enum(["custom", "catalog"]).default("custom"),
  line_item_master_id: z.string().uuid().nullish(),
  sort_order: z.number().int().default(0),
});

export const createInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      job_id: z.string().uuid().nullish(),
      client_id: z.string().uuid().nullish(),
      customer_name: z.string().max(255).nullish(),
      customer_email: z.string().email().nullish().or(z.literal("")),
      customer_phone: z.string().max(50).nullish(),
      customer_address: z.string().max(1000).nullish(),
      issue_date: z.string().nullish(),
      due_date: z.string().nullish(),
      tax_pct: z.number().min(0).max(100).default(0),
      discount: z.number().min(0).default(0),
      notes: z.string().max(4000).nullish(),
      terms: z.string().max(4000).nullish(),
      template_id: z.string().uuid().nullish(),
      line_items: z.array(lineItemSchema).default([]),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .single();
    if (!profile?.company_id) throw new Error("No company");

    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert({
        company_id: profile.company_id,
        invoice_number: "", // overwritten by assign_invoice_number trigger
        job_id: data.job_id ?? null,
        client_id: data.client_id ?? null,
        customer_name: data.customer_name ?? null,
        customer_email: data.customer_email || null,
        customer_phone: data.customer_phone ?? null,
        customer_address: data.customer_address ?? null,
        issue_date: data.issue_date ?? new Date().toISOString().slice(0, 10),
        due_date: data.due_date ?? null,
        tax_pct: data.tax_pct,
        discount: data.discount,
        notes: data.notes ?? null,
        terms: data.terms ?? null,
        template_id: data.template_id ?? null,
      } as any)
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    if (data.line_items.length) {
      const rows = data.line_items.map((li, idx) => ({
        invoice_id: invoice.id,
        name: li.name,
        description: li.description ?? null,
        unit: li.unit,
        qty: li.qty,
        unit_price: li.unit_price,
        total: Number((li.qty * li.unit_price).toFixed(2)),
        kind: li.kind,
        line_item_master_id: li.line_item_master_id ?? null,
        sort_order: li.sort_order ?? idx,
      }));
      const { error: lineErr } = await supabase.from("invoice_line_items").insert(rows);
      if (lineErr) throw new Error(lineErr.message);
    }

    return { id: invoice.id };
  });

export const updateInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      patch: z.object({
        customer_name: z.string().nullish(),
        customer_email: z.string().nullish(),
        customer_phone: z.string().nullish(),
        customer_address: z.string().nullish(),
        issue_date: z.string().nullish(),
        due_date: z.string().nullish(),
        tax_pct: z.number().nullish(),
        discount: z.number().nullish(),
        notes: z.string().nullish(),
        terms: z.string().nullish(),
        template_id: z.string().uuid().nullish(),
        status: z.enum(["draft", "sent", "partial", "paid", "void", "overdue"]).optional(),
      }),
      line_items: z.array(lineItemSchema).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const patch: any = { ...data.patch };
    if (data.patch.status === "sent") patch.sent_at = new Date().toISOString();

    const { error } = await supabase.from("invoices").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);

    if (data.line_items) {
      // Replace all line items
      const { error: delErr } = await supabase
        .from("invoice_line_items")
        .delete()
        .eq("invoice_id", data.id);
      if (delErr) throw new Error(delErr.message);

      if (data.line_items.length) {
        const rows = data.line_items.map((li, idx) => ({
          invoice_id: data.id,
          name: li.name,
          description: li.description ?? null,
          unit: li.unit,
          qty: li.qty,
          unit_price: li.unit_price,
          total: Number((li.qty * li.unit_price).toFixed(2)),
          kind: li.kind,
          line_item_master_id: li.line_item_master_id ?? null,
          sort_order: li.sort_order ?? idx,
        }));
        const { error: insErr } = await supabase.from("invoice_line_items").insert(rows);
        if (insErr) throw new Error(insErr.message);
      }
    }

    return { ok: true };
  });

export const recordInvoicePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      invoice_id: z.string().uuid(),
      amount: z.number().positive(),
      method: z.enum(["cash", "check", "ach", "stripe", "paypal", "other"]),
      reference: z.string().max(255).nullish(),
      paid_at: z.string().nullish(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: invoice } = await supabase
      .from("invoices")
      .select("company_id")
      .eq("id", data.invoice_id)
      .single();
    if (!invoice) throw new Error("Invoice not found");

    const { error } = await supabase.from("invoice_payments").insert({
      invoice_id: data.invoice_id,
      company_id: invoice.company_id,
      amount: data.amount,
      method: data.method,
      reference: data.reference ?? null,
      paid_at: data.paid_at ?? new Date().toISOString(),
      recorded_by: userId,
      status: "succeeded",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteInvoicePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ payment_id: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("invoice_payments")
      .delete()
      .eq("id", data.payment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const voidInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("invoices")
      .update({ status: "void" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("invoices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
