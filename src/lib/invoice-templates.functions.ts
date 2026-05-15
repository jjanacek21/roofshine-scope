import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const layoutSchema = z.object({
  theme: z.string().default("custom"),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#1e40af"),
  accent_text: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ffffff"),
  bg: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ffffff"),
  text: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0f172a"),
  muted: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#64748b"),
  heading_font: z.enum(["sans-serif", "serif", "mono"]).default("sans-serif"),
  body_font: z.enum(["sans-serif", "serif", "mono"]).default("sans-serif"),
  header_style: z.enum(["banner", "split", "clean", "block"]).default("banner"),
  table_style: z.enum(["lined", "zebra", "borderless", "boxed"]).default("lined"),
  logo_position: z.enum(["left", "right"]).default("left"),
  show_accent_stripe: z.boolean().default(true),
});

export type InvoiceLayout = z.infer<typeof layoutSchema>;

export const generateInvoiceTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      prompt: z.string().min(3).max(1000),
      name: z.string().min(1).max(120),
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

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured");

    const systemPrompt = `You are an invoice design system. Given a user's design brief, return a JSON layout spec via the design_invoice_template tool. Pick colors that work together with strong contrast. Prefer professional, clean designs unless the brief explicitly asks for something playful.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Design brief: ${data.prompt}\n\nReturn the layout spec.` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "design_invoice_template",
              description: "Return a JSON invoice layout spec",
              parameters: {
                type: "object",
                properties: {
                  accent: { type: "string", description: "Primary accent color, hex like #1e40af" },
                  accent_text: { type: "string", description: "Text color on accent backgrounds, hex" },
                  bg: { type: "string", description: "Page background color, hex" },
                  text: { type: "string", description: "Body text color, hex" },
                  muted: { type: "string", description: "Muted/secondary text color, hex" },
                  heading_font: { type: "string", enum: ["sans-serif", "serif", "mono"] },
                  body_font: { type: "string", enum: ["sans-serif", "serif", "mono"] },
                  header_style: { type: "string", enum: ["banner", "split", "clean", "block"] },
                  table_style: { type: "string", enum: ["lined", "zebra", "borderless", "boxed"] },
                  logo_position: { type: "string", enum: ["left", "right"] },
                  show_accent_stripe: { type: "boolean" },
                },
                required: ["accent", "accent_text", "bg", "text", "muted", "heading_font", "body_font", "header_style", "table_style", "logo_position", "show_accent_stripe"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "design_invoice_template" } },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 429) throw new Error("AI rate limit reached. Please wait a minute.");
      if (response.status === 402) throw new Error("AI credits exhausted. Add funds in workspace settings.");
      throw new Error(`AI gateway error: ${text.slice(0, 200)}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return a layout");

    const args = JSON.parse(toolCall.function.arguments);
    const layout = layoutSchema.parse({ theme: "ai", ...args });

    const { data: tpl, error } = await supabase
      .from("invoice_templates")
      .insert({
        company_id: profile.company_id,
        name: data.name,
        kind: "ai",
        layout,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { template: tpl };
  });

export const setDefaultTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ template_id: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .single();
    if (!profile?.company_id) throw new Error("No company");

    await supabase
      .from("invoice_templates")
      .update({ is_default: false })
      .eq("company_id", profile.company_id);
    const { error } = await supabase
      .from("invoice_templates")
      .update({ is_default: true })
      .eq("id", data.template_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ template_id: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("invoice_templates")
      .delete()
      .eq("id", data.template_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
