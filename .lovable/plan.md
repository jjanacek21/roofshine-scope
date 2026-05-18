
# Invoice payments: your Stripe + Zelle + confirmation emails

You already have invoice checkout working through Lovable's built-in Stripe. This plan moves it to **your own Stripe account**, adds a **Zelle option** on the public pay page, and sends a **confirmation email** with the Stripe payment ID after every successful payment. Membership/SaaS billing is explicitly **out of scope** for this round — we'll do that separately later.

## Step 1 — Set up your sender email domain

A confirmation email needs a verified domain (e.g. `notify.globalcontractor.app`) so emails come from your brand and land in inboxes. You'll click through a short setup dialog, paste the DNS records into your domain registrar, and we proceed while DNS verifies in the background.

## Step 2 — Connect your own Stripe account (BYOK)

Replace the built-in Stripe connection with your own keys. You'll provide:
- Your Stripe **secret key** (`sk_live_…` and/or `sk_test_…`)
- Your Stripe **publishable key** (`pk_live_…` / `pk_test_…`)
- A Stripe **webhook signing secret** (`whsec_…`) — we'll give you the webhook URL to register in your Stripe dashboard

We rewire the existing checkout (`createPublicInvoiceCheckout`, `PublicStripeCheckout`, the `pay.$token` page, and the `/api/public/payments/webhook` handler) to use your account directly instead of routing through Lovable's connector gateway.

## Step 3 — Add a Zelle option on the pay page

On `/pay/$token`, add a second payment method tab next to "Credit card":

- **Zelle** — shows the number **214-998-2879** with a copy button, the invoice amount, and an **"I sent it"** button.
- Clicking "I sent it" records a payment intent in a new `status = 'zelle_pending'` state on the invoice, with a generated confirmation number. The invoice shows as "Pending Zelle verification" until you manually mark it received from the in-app invoice page (new "Confirm Zelle payment" button for staff).

## Step 4 — Send confirmation email after every payment

Set up one transactional template, **`payment-received`**, that says:
- "We received your payment of $X toward invoice #1234"
- Confirmation number: the **Stripe session/payment ID** (e.g. `cs_live_abc123…`) for card payments, or the generated Zelle reference for Zelle
- "Processing — we'll follow up if anything's needed"
- Your company name and a contact line

Triggered automatically from:
- The **Stripe webhook handler** when `checkout.session.completed` fires (card payments)
- The **"I sent it"** Zelle action (with "pending verification" wording)
- The staff **"Confirm Zelle payment"** action (with "verified" wording)

## Out of scope (separate future task)

- Membership / per-user monthly billing for selling the app to other companies — we'll plan and build that as its own project once invoice payments are stable.

## Technical notes

- **BYOK Stripe**: Replaces `createStripeClient` in `src/lib/stripe.server.ts` with a direct `new Stripe(process.env.STRIPE_SECRET_KEY)` (no gateway proxy). Removes dependency on `LOVABLE_API_KEY` / `STRIPE_SANDBOX_API_KEY`. Webhook secret becomes `STRIPE_WEBHOOK_SECRET` (single env, no sandbox/live split). Publishable key moves into `VITE_STRIPE_PUBLISHABLE_KEY`. The existing `environment` column on `invoice_payment_intents` stays but defaults to whatever the key implies.
- **Schema changes**:
  - `invoices.status` gets a new value `'zelle_pending'`
  - New `invoice_payments` rows for Zelle with `method = 'zelle'`, `status = 'pending'` until staff confirms (then `'succeeded'`)
  - New `confirmation_number` column on `invoice_payments` (text, nullable)
- **Email**: Lovable Email infrastructure (pgmq queue + cron dispatcher) gets set up. One template `payment-received.tsx` in `src/lib/email-templates/`. Sent via the standard `send-transactional-email` route from the webhook handler and Zelle action handlers.
- **Files touched**: `stripe.server.ts`, `payments.functions.ts`, `StripeCheckout.tsx`, `pay.$token.tsx`, `api/public/payments/webhook.ts`, `_app.invoices.$id.tsx` (add "Confirm Zelle payment" button), one new server fn for the Zelle "I sent it" action, the new email template + registry entry.

<presentation-actions>
<presentation-open-email-setup>Set up email domain</presentation-open-email-setup>
</presentation-actions>
