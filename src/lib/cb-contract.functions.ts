import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SignInput = z.object({
  jobId: z.string().uuid(),
  docType: z.enum(["contingency", "retail"]),
  signerName: z.string().min(2).max(120),
  signerEmail: z.string().email(),
  signaturePng: z.string().min(64).max(4_000_000),
  bodyHtml: z.string().max(200_000),
});

/**
 * Records the signature server-side so IP and user agent come from the request
 * rather than the browser, flips the job to `signed` and writes the audit row.
 */
export const cbSignContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => SignInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: job } = await supabase
      .from("cb_jobs")
      .select("id, workspace_id, company_id, customer_name")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job) return { ok: false as const, error: "Job not found" };

    const ip = getRequestIP({ xForwardedFor: true }) ?? null;
    const userAgent = getRequestHeader("user-agent") ?? null;
    const signedAt = new Date().toISOString();

    const { data: existing } = await supabase
      .from("cb_contracts")
      .select("id")
      .eq("job_id", data.jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const row = {
      job_id: data.jobId,
      doc_type: data.docType,
      body_html: data.bodyHtml,
      signer_name: data.signerName,
      signer_email: data.signerEmail,
      signature_png: data.signaturePng,
      signed_at: signedAt,
      ip,
      user_agent: userAgent,
    };

    const saved = existing?.id
      ? await supabase.from("cb_contracts").update(row).eq("id", existing.id).select("id").maybeSingle()
      : await supabase.from("cb_contracts").insert(row).select("id").maybeSingle();

    if (saved.error || !saved.data) {
      return { ok: false as const, error: saved.error?.message ?? "Could not save the agreement" };
    }

    await supabase.from("cb_jobs").update({ status: "signed" }).eq("id", data.jobId);

    await supabase.from("cb_audit_log").insert({
      workspace_id: job.workspace_id,
      actor: userId,
      action: "contract.signed",
      entity: "cb_contracts",
      entity_id: saved.data.id,
      meta: {
        job_id: data.jobId,
        doc_type: data.docType,
        signer_name: data.signerName,
        signer_email: data.signerEmail,
        signed_at: signedAt,
        ip,
        user_agent: userAgent,
      },
    });

    return {
      ok: true as const,
      contractId: saved.data.id,
      workspaceId: job.workspace_id,
      signedAt,
      ip,
      userAgent,
    };
  });

const EmailInput = z.object({
  contractId: z.string().uuid(),
  to: z.array(z.string().email()).min(1).max(4),
});

/** Emails the countersigned PDF to the homeowner and the company. */
export const cbEmailContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => EmailInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const RESEND_API_KEY = process.env['RESEND_API_KEY'];
    if (!RESEND_API_KEY) return { ok: false as const, error: "Email provider not configured" };

    const { data: contract } = await supabase
      .from("cb_contracts")
      .select("id, job_id, doc_type, pdf_path, signer_name, signed_at")
      .eq("id", data.contractId)
      .maybeSingle();
    if (!contract) return { ok: false as const, error: "Agreement not found" };

    const { data: job } = await supabase
      .from("cb_jobs")
      .select("address, city, state, company_id, customer_name")
      .eq("id", contract.job_id)
      .maybeSingle();
    const { data: company } = job?.company_id
      ? await supabase.from("cb_companies").select("name, legal_name, phone, email").eq("id", job.company_id).maybeSingle()
      : { data: null };

    const address = [job?.address, job?.city, job?.state].filter(Boolean).join(", ");
    const companyName = company?.name ?? "Your contractor";
    const docLabel = contract.doc_type === "retail" ? "retail repair agreement" : "insurance contingency agreement";

    const attachments: { filename: string; content: string }[] = [];
    if (contract.pdf_path) {
      const { data: file } = await supabase.storage.from("cb-documents").download(contract.pdf_path);
      if (file) {
        const buf = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (let i = 0; i < buf.length; i += 8192) binary += String.fromCharCode(...buf.subarray(i, i + 8192));
        attachments.push({ filename: "agreement.pdf", content: btoa(binary) });
      }
    }

    const html = `
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#111">
        <p>Hi ${contract.signer_name ?? job?.customer_name ?? "there"},</p>
        <p>Attached is the signed ${docLabel} for <strong>${address}</strong>, countersigned by ${
          company?.legal_name || companyName
        }.</p>
        <p>Keep this copy for your records. If you have any questions, reply to this email or call us.</p>
        <p>— ${companyName}${company?.phone ? ` · ${company.phone}` : ""}</p>
        <p style="font-size:12px;color:#666">The homeowner is responsible for the full insurance deductible; it cannot be waived, rebated or absorbed. The contractor is not a public adjuster and signing does not guarantee the claim will be approved.</p>
      </div>`;

    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Connection-Api-Key": RESEND_API_KEY },
      body: JSON.stringify({
        from: `${companyName} <onboarding@resend.dev>`,
        to: data.to,
        subject: `Your signed agreement — ${address}`,
        html,
        ...(attachments.length ? { attachments } : {}),
      }),
    });

    if (!res.ok) return { ok: false as const, error: `Email failed (${res.status})` };
    return { ok: true as const };
  });
