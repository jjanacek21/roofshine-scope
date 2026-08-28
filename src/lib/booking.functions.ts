import { createServerFn } from "@tanstack/react-start";
import { sendMail, shell } from "./cb-mail.server";

/**
 * Demo and founding-seat bookings from the public marketing pages.
 *
 * Two emails go out on every submission and neither is optional: the customer
 * gets a confirmation that repeats back the time they picked, and the platform
 * owners get the lead while it is still warm. A booking that only lands in a
 * table is a booking nobody follows up on.
 *
 * The write runs through the anon client on purpose — the table's RLS allows
 * an insert from anyone and a read from nobody but a super admin, so a public
 * form can file a request without exposing the pipeline behind it.
 */

export type BookingKind = "demo" | "seat";
export type BookingProduct = "gcn" | "claims";

export type BookingInput = {
  kind: BookingKind;
  product: BookingProduct;
  name: string;
  company?: string;
  email: string;
  phone?: string;
  industry?: string;
  teamSize?: string;
  currentTools?: string;
  goals?: string;
  wants?: string[];
  address?: string;
  question?: string;
  preferredDate?: string;
  preferredTime?: string;
  timezone?: string;
};

const PRODUCT_NAME: Record<BookingProduct, string> = {
  gcn: "Global Contractor Network",
  claims: "Claim Buddy",
};

const PRODUCT_URL: Record<BookingProduct, string> = {
  gcn: "https://globalcontractor.app",
  claims: "https://gcn.claims",
};

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "Thursday, 4 September 2026 at 9:00 AM CT" — or an honest fallback. */
function whenLine(input: BookingInput): string {
  if (!input.preferredDate) return "We will call you to lock in a time.";
  const d = new Date(input.preferredDate + "T12:00:00");
  const date = Number.isNaN(d.getTime())
    ? input.preferredDate
    : d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
  const time = input.preferredTime ? ` at ${input.preferredTime}` : "";
  const tz = input.timezone ? ` ${input.timezone}` : "";
  return `${date}${time}${tz}`;
}

/** What an onboarding call actually needs in front of it. */
const BRING_LIST = [
  "Your business licence and any trade or qualifier licences",
  "General liability and workers' comp certificates (COIs)",
  "Your standard contract, contingency agreement and change order",
  "A current price book or the last few estimates you sent",
  "Supplier price sheets from whoever you buy material from",
  "Your logo, letterhead and the warranty language you use",
  "A list of your reps and the email addresses they should log in with",
  "One job you are working right now, so we set it up together on the call",
];

function customerEmail(input: BookingInput) {
  const product = PRODUCT_NAME[input.product];
  const when = whenLine(input);

  if (input.kind === "seat") {
    return {
      subject: `Your founding seat is reserved — ${product}`,
      html: shell(
        "Your founding seat is reserved",
        `<p>Thanks ${esc(input.name.split(" ")[0])} — your seat is held and your onboarding call is set.</p>
         <p style="margin:16px 0;padding:14px 16px;border-left:3px solid #17c27a;background:#f3faf6">
           <strong>Onboarding call</strong><br>${esc(when)}
         </p>
         <p>Onboarding is the call where your account stops being empty. We build your
         price book, load your documents and set up your first job together — so the
         more of this you have to hand, the further we get in one sitting:</p>
         <ul style="padding-left:18px;line-height:1.7">
           ${BRING_LIST.map((b) => `<li>${esc(b)}</li>`).join("")}
         </ul>
         <p>Nothing on that list is a blocker. Come with what you have and we will
         work around the rest.</p>
         <p>Your founding rate is locked from today, for as long as you stay — every
         module on the roadmap lands in your account at no extra cost as it ships.</p>
         <p>If the time no longer works, just reply to this email and we will move it.</p>`,
        { label: `Open ${product}`, href: PRODUCT_URL[input.product] },
      ),
    };
  }

  return {
    subject: `Your demo is booked — ${product}`,
    html: shell(
      "Your demo is booked",
      `<p>Thanks ${esc(input.name.split(" ")[0])} — you're on the calendar.</p>
       <p style="margin:16px 0;padding:14px 16px;border-left:3px solid #17c27a;background:#f3faf6">
         <strong>Demo call</strong><br>${esc(when)}
       </p>
       ${
         input.address
           ? `<p>We'll measure <strong>${esc(input.address)}</strong> before the call and
              walk through the result live. You keep the report either way.</p>`
           : `<p>Bring an address you're working right now and we'll measure it live on
              the call. You keep the report either way.</p>`
       }
       <p>It's a working session, not a slideshow — bring one job you're quoting and
       one you lost, and we'll run both.</p>
       <p>Need to move it? Reply to this email.</p>`,
      { label: `Open ${product}`, href: PRODUCT_URL[input.product] },
    ),
  };
}

function ownerEmail(input: BookingInput) {
  const product = PRODUCT_NAME[input.product];
  const label = input.kind === "seat" ? "Founding seat" : "Demo";
  const row = (k: string, v?: string | string[]) => {
    const val = Array.isArray(v) ? v.join(", ") : v;
    if (!val) return "";
    return `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;white-space:nowrap;vertical-align:top">${esc(k)}</td>
            <td style="padding:6px 0;color:#0b0b0c">${esc(val)}</td></tr>`;
  };
  return {
    subject: `${label} request — ${input.name}${input.company ? ` (${input.company})` : ""}`,
    html: shell(
      `New ${label.toLowerCase()} request`,
      `<p><strong>${esc(product)}</strong></p>
       <table style="width:100%;border-collapse:collapse;font-size:14px">
         ${row("Name", input.name)}
         ${row("Company", input.company)}
         ${row("Email", input.email)}
         ${row("Mobile", input.phone)}
         ${row("Requested", whenLine(input))}
         ${row("Industry", input.industry)}
         ${row("Team size", input.teamSize)}
         ${row("Using today", input.currentTools)}
         ${row("Wants", input.wants)}
         ${row("Address", input.address)}
         ${row("Trying to fix", input.goals)}
         ${row("Asked", input.question)}
       </table>`,
    ),
  };
}

/** The Global Contractor Network company inbox. Every booking lands here. */
const GCN_INBOX = "Admin@gcn.support";

export const submitBooking = createServerFn({ method: "POST" })
  .validator((d: BookingInput) => d)
  .handler(async ({ data }) => {
    if (!data?.name?.trim() || !data?.email?.trim()) {
      throw new Error("Name and email are required.");
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email.trim())) {
      throw new Error("That email address doesn't look right.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("booking_requests").insert({
      kind: data.kind,
      product: data.product,
      name: data.name.trim(),
      company: data.company?.trim() || null,
      email: data.email.trim().toLowerCase(),
      phone: data.phone?.trim() || null,
      industry: data.industry || null,
      team_size: data.teamSize || null,
      current_tools: data.currentTools?.trim() || null,
      goals: data.goals?.trim() || null,
      wants: data.wants ?? [],
      address: data.address?.trim() || null,
      question: data.question?.trim() || null,
      preferred_date: data.preferredDate || null,
      preferred_time: data.preferredTime || null,
      timezone: data.timezone || null,
    } as never);
    if (error) throw new Error(error.message);

    /* Who gets told. Bookings are sales leads, so they go to the company
       inbox rather than to whoever happens to hold the super_admin role —
       promoting an admin should not quietly start forwarding leads to them.
       BOOKING_NOTIFY_TO overrides, and accepts a comma-separated list. */
    const notify = (process.env["BOOKING_NOTIFY_TO"] || GCN_INBOX)
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    const cust = customerEmail(data);
    const own = ownerEmail(data);

    /* Neither send blocks the other, and a mail failure never loses the
       booking — the row is already committed above. */
    const [custRes, ownRes] = await Promise.all([
      sendMail({ to: data.email.trim(), subject: cust.subject, html: cust.html }),
      notify.length
        ? sendMail({
            to: Array.from(new Set(notify)),
            subject: own.subject,
            html: own.html,
            replyTo: data.email.trim(),
          })
        : Promise.resolve({ ok: false, error: "No super admin email on file" }),
    ]);

    return {
      ok: true,
      confirmationSent: custRes.ok,
      notified: ownRes.ok,
      when: whenLine(data),
    };
  });
