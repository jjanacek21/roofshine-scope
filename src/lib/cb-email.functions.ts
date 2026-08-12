import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  reportId: z.string().uuid(),
  to: z.string().email(),
  audience: z.enum(["homeowner", "adjuster"]),
  link: z.string().url().optional(),
  pdfPath: z.string().max(500).optional(),
  message: z.string().max(4000).optional(),
});

/** Emails the damage report as a link plus, when available, the stored PDF. */
export const cbEmailReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const RESEND_API_KEY = process.env['RESEND_API_KEY'];
    if (!RESEND_API_KEY) return { ok: false as const, error: "Email provider not configured" };

    /* RLS scopes this read to the caller's workspace. */
    const { data: report } = await supabase
      .from("cb_reports")
      .select("id, version, job_id, pdf_path")
      .eq("id", data.reportId)
      .maybeSingle();
    if (!report) return { ok: false as const, error: "Report not found" };

    const { data: job } = await supabase
      .from("cb_jobs")
      .select("address, city, state, zip, customer_name, carrier, claim_number, company_id")
      .eq("id", report.job_id)
      .maybeSingle();
    const { data: company } = job?.company_id
      ? await supabase.from("cb_companies").select("name, phone, email").eq("id", job.company_id).maybeSingle()
      : { data: null };

    const address = [job?.address, job?.city, job?.state].filter(Boolean).join(", ");
    const companyName = company?.name ?? "Your contractor";
    const subject =
      data.audience === "adjuster"
        ? `Property damage inspection report — ${address}${job?.claim_number ? ` — claim ${job.claim_number}` : ""}`
        : `Your inspection report — ${address}`;

    const attachments: { filename: string; content: string }[] = [];
    const path = data.pdfPath ?? report.pdf_path;
    if (path) {
      const { data: file } = await supabase.storage.from("cb-documents").download(path);
      if (file) {
        const buf = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (let i = 0; i < buf.length; i += 8192) binary += String.fromCharCode(...buf.subarray(i, i + 8192));
        attachments.push({ filename: `report-v${report.version}.pdf`, content: btoa(binary) });
      }
    }

    const html = `
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#111">
        <p>${data.audience === "adjuster" ? "Adjuster" : `Hi ${job?.customer_name ?? "there"}`},</p>
        <p>${
          data.message ??
          `Attached is the property damage inspection report for <strong>${address}</strong>${
            job?.claim_number ? `, claim number ${job.claim_number}` : ""
          }${job?.carrier ? ` with ${job.carrier}` : ""}. It documents the conditions observed on site, the measurements and the recommended scope of repair.`
        }</p>
        ${data.link ? `<p><a href="${data.link}" style="color:#15803d">View the report online</a> (link expires in 30 days)</p>` : ""}
        <p>— ${companyName}${company?.phone ? ` · ${company.phone}` : ""}</p>
        <p style="font-size:12px;color:#666">This report documents observed conditions. It is not a determination of coverage; the carrier makes the coverage decision. The contractor is not a public adjuster.</p>
      </div>`;

    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: `${companyName} <onboarding@resend.dev>`,
        to: [data.to],
        subject,
        html,
        ...(attachments.length ? { attachments } : {}),
      }),
    });

    if (!res.ok) {
      return { ok: false as const, error: `Email failed (${res.status})` };
    }
    return { ok: true as const };
  });
