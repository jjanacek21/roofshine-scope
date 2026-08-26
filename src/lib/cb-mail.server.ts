/**
 * Server-only Resend helper for Claim Buddy account emails
 * (invitations, signup confirmations, demo requests).
 */

export const CB_APP_URL = "https://gcn.claims";

/**
 * The one invite URL every email must use.
 *
 * It has to live under /cb. gcn.claims redirects any path outside /cb to the
 * app home and drops the query string with it, so an invite sent to a top-level
 * path arrives at /cb with no token — and a signed-out recipient is then handed
 * the paid signup funnel. Four senders each built this string by hand and all
 * four had it wrong; they call this now.
 */
export function cbInviteUrl(token: string | null | undefined): string {
  return `${CB_APP_URL}/cb/accept?token=${token ?? ""}`;
}

function fromAddress() {
  return process.env["RESEND_FROM"] ?? "Claim Buddy <noreply@globalcontractor.app>";
}

export async function sendMail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env["RESEND_API_KEY"];
  if (!key) return { ok: false, error: "Email provider not configured" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromAddress(),
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Resend send failed", res.status, body);
    return { ok: false, error: `Email failed (${res.status})` };
  }
  return { ok: true };
}

export function shell(title: string, body: string, cta?: { label: string; href: string }) {
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#0b0b0c">
    <h2 style="margin:0 0 12px;font-size:20px;color:#0b0b0c">${title}</h2>
    <div style="font-size:15px;line-height:1.55;color:#3a3a3d">${body}</div>
    ${
      cta
        ? `<p style="margin:28px 0"><a href="${cta.href}" style="background:#15803d;color:#fff;padding:13px 24px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">${cta.label}</a></p>
           <p style="font-size:12.5px;color:#8a8a8e;word-break:break-all">Or paste this link into your browser:<br>${cta.href}</p>`
        : ""
    }
    <p style="font-size:12px;color:#a0a0a5;margin-top:28px">Claim Buddy · Global Contractor Network</p>
  </div>`;
}
