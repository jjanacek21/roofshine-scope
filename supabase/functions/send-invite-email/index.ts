import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, inviteUrl } = await req.json();
    if (!email || !inviteUrl) {
      return new Response(
        JSON.stringify({ error: "Missing email or inviteUrl" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Email service not configured", skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111;">You've been invited to Global Contractor</h2>
        <p style="color: #444; font-size: 15px; line-height: 1.5;">
          You were invited to join a company workspace. Click the button below to accept the invite and get started.
        </p>
        <p style="margin: 32px 0;">
          <a href="${inviteUrl}" style="background: #1e90ff; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Accept invite</a>
        </p>
        <p style="color: #888; font-size: 13px;">
          Or paste this link into your browser:<br>
          <a href="${inviteUrl}" style="color: #1e90ff; word-break: break-all;">${inviteUrl}</a>
        </p>
        <p style="color: #aaa; font-size: 12px; margin-top: 32px;">This invite expires in 14 days.</p>
      </div>
    `;

    const FROM = Deno.env.get("RESEND_FROM") ?? "Global Contractor <noreply@globalcontractor.app>";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: "You've been invited to Global Contractor",
        html,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      console.error("Resend send failed", { status: res.status, result, from: FROM, to: email });
      return new Response(
        JSON.stringify({ error: result?.message ?? "Send failed", result }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
