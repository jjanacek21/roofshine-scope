import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SendInput = z.object({
  leadId: z.string().uuid(),
  channel: z.enum(["email", "text"]),
  recipient: z.string().min(3).max(200),
  subject: z.string().min(1).max(200).optional(),
  message: z.string().max(5000).optional(),
  reportName: z.string().max(200).default("Savings Report"),
  // base64-encoded PDF (no data: prefix)
  pdfBase64: z.string().min(10).max(20_000_000).optional(),
});

export const sendLeadReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => SendInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // SMS not yet wired up — fail early so the UI can disable that path.
    if (data.channel === "text") {
      return { ok: false, error: "SMS provider not configured" } as const;
    }

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      return { ok: false, error: "Email provider not configured" } as const;
    }

    // Look up lead for context (RLS scopes to caller's company).
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id, address, city, state, zip, owner, status, company_id")
      .eq("id", data.leadId)
      .maybeSingle();
    if (leadErr || !lead) {
      return { ok: false, error: "Lead not found" } as const;
    }

    const propLine = [lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(", ");
    const subject = data.subject ?? `Your free roof savings report — ${lead.address}`;
    const html = `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; line-height: 1.5;">
        <p>Hi${lead.owner ? ` ${lead.owner}` : ""},</p>
        <p>${data.message ? data.message.replace(/\n/g, "<br>") : `Attached is your free SPF restoration vs. tear-off comparison for <b>${propLine}</b>. It walks through the 20-year cost difference, energy savings, and re-coat schedule so you can see the numbers side by side.`}</p>
        <p>Reply to this email if you'd like a walkthrough or have questions.</p>
        <p style="color:#64748b; font-size:12px;">Sent via Roof Kings SPF Prospecting</p>
      </div>
    `;

    const attachments = data.pdfBase64
      ? [{ filename: `${data.reportName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`, content: data.pdfBase64 }]
      : undefined;

    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "Roof Kings <onboarding@resend.dev>",
        to: [data.recipient],
        subject,
        html,
        attachments,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Resend send failed:", res.status, text);
      return { ok: false, error: `Email send failed (${res.status})` } as const;
    }

    // Log the send + nudge status from new -> contacted.
    await supabase.from("lead_activities").insert({
      lead_id: data.leadId,
      user_id: userId,
      type: "report_sent",
      note: `email→${data.recipient}`,
    });

    if (lead.status === "new") {
      await supabase.from("leads").update({ status: "contacted" }).eq("id", data.leadId);
    }

    return { ok: true } as const;
  });
