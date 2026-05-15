
# Custom Invoice Maker

Schema already exists (`invoices`, `invoice_line_items`, `invoice_payments`, `invoice_templates`, `invoice_payment_intents`). Triggers auto-recompute totals, balance, and status. Missing: UI, AI template designer, payment flows.

## What you'll get

1. **`/invoices`** — list of all your invoices (status pills, total, paid, due, search/filter by job/client/status).
2. **`/invoices/new`** — pick a job (auto-fills client + property + contract price from latest approved order snapshot), or start blank. Default total = approved snapshot's `total_with_tax`. You can override.
3. **`/invoices/$id/edit`** — full editor:
   - Customer block (name/address/email/phone, auto-filled from client, editable).
   - Line items: **add custom** (name + qty + unit + price) OR **search catalog** via the existing `AddLineItemCombobox` (line_item_master). Drag to reorder, edit inline.
   - Discount, tax %, notes, terms, due date.
   - Template picker (4 presets + "Design with AI" — see below).
   - Live preview pane on the right (renders the selected template with your data).
   - Save / Send / Mark sent / Void / Download PDF.
4. **`/invoices/$id/pay`** (public, token-gated via `public_pay_token`) — what your customer sees:
   - Branded invoice with company logo, line items, total, amount paid, **amount due**.
   - Payment buttons: **Pay with Card**, **Pay with Link**, **Pay with PayPal**, **Pay with Bank (ACH)**, plus a "Wire / check instructions" panel.
   - Customer can pay **any amount** (defaults to `amount_due`) — supports partial payments.
5. **Record payment dialog** (internal, on `/invoices/$id`) — manually log cash/check/wire/Zelle with reference + date. Status auto-updates to `partial` or `paid`.

## AI template designer

Two modes in the template picker:
- **4 presets** seeded once: Classic, Modern, Minimal, Bold. Stored as `invoice_templates` rows with `kind='preset'`, shared at `company_id = NULL`.
- **"Design with AI"** dialog: free-text prompt ("clean dark mode with gold accents, big logo top-right"). Calls a `createServerFn` `generateInvoiceTemplate` that hits Lovable AI Gateway (`google/gemini-2.5-pro`) with a strict JSON schema for `layout` (colors, fonts, header style, line-item table style, footer style, accent stripes, etc.). Saves as `invoice_templates` with `kind='ai'`, `company_id = your company`. Renders live in the preview pane. You can edit, duplicate, set as default.

The PDF renderer (`src/lib/invoice-pdf.ts`, jsPDF-based, mirrors existing `lead-report-pdf.ts`) reads the `layout` JSON and renders accordingly — same code path for preset and AI templates.

## Payment flows

### Stripe (card + Link + ACH)
- New `src/lib/stripe.server.ts` (gateway-routed client).
- `createInvoiceCheckout` server fn: takes `invoiceId` + `amount`, creates a Stripe Checkout Session in `payment` mode with `payment_method_types: ['card', 'link', 'us_bank_account']`, writes a row to `invoice_payment_intents`, returns the hosted URL.
- Webhook at `/api/public/payments/webhook` (`?env=sandbox|live`): verifies signature, on `checkout.session.completed` looks up the `invoice_payment_intents` row by `session.id`, inserts an `invoice_payments` row (`method='stripe'`, `status='succeeded'`, amount from session). Triggers auto-recompute balance + status.

### PayPal
- New `src/lib/paypal.server.ts` (REST API, sandbox + live by env var).
- `createPayPalOrder` + `capturePayPalOrder` server fns. PayPal JS SDK button on the public pay page.
- Webhook at `/api/public/paypal/webhook`: verifies signature with `PAYPAL_WEBHOOK_ID`, on `PAYMENT.CAPTURE.COMPLETED` inserts `invoice_payments` row (`method='paypal'`).
- Needs 3 secrets: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` — I'll request them only when you're ready to enable PayPal. Card/Link/ACH via Stripe works immediately.

### Bank transfer / wire / check
- Two paths:
  - On the public page: a "Pay by ACH" button uses Stripe's `us_bank_account` flow (above).
  - "Wire / check" panel shows your bank instructions (configurable on company settings: routing, account, memo) — customer mails or wires, you log it manually via the **Record payment** dialog.

### Partial payments
- All flows write rows to `invoice_payments` with whatever `amount` was paid. The `recompute_invoice_balance` trigger sums them and sets status to `paid` only when `sum >= total`, otherwise `partial`. Multiple payments per invoice supported natively.

## Pulling contract price from a job

When you click "Create invoice" from a job:
- Loads the latest `job_order_snapshots` row where `status='approved'`.
- Pre-fills line items from `materials` + `labor` JSONB (or one consolidated "Contract — {job name}" line at the snapshot's grand total — your choice via a toggle in the new-invoice dialog).
- Pre-fills customer block from `clients` joined via `jobs.client_id`.
- Pre-fills property address from `jobs.property_address`.

## File map

```text
src/lib/
├── stripe.server.ts                 (new — gateway client + verifyWebhook)
├── paypal.server.ts                 (new — REST helpers; deferred until creds)
├── invoice-pdf.ts                   (new — jsPDF renderer reading layout JSON)
├── invoices.functions.ts            (new — CRUD + sendInvoice + recordPayment)
├── invoice-templates.functions.ts   (new — list/create/duplicate + generateInvoiceTemplate AI fn)
└── payments.functions.ts            (new — createInvoiceCheckout + createPayPalOrder)

src/routes/
├── _app.invoices.index.tsx          (new — list page)
├── _app.invoices.new.tsx            (new — pick job + template, prefill)
├── _app.invoices.$id.tsx            (new — editor with live preview + record-payment dialog)
├── pay.$token.tsx                   (new — public page, no auth)
└── api/public/
    ├── payments/webhook.ts          (new — Stripe webhook)
    └── paypal/webhook.ts            (new — PayPal webhook, deferred until creds)

src/components/invoices/
├── InvoiceEditor.tsx
├── InvoiceLineItemRow.tsx
├── InvoiceTemplatePicker.tsx
├── DesignWithAIDialog.tsx
├── InvoicePreview.tsx               (renders layout JSON in browser, mirror of PDF)
├── RecordPaymentDialog.tsx
└── PublicPayButtons.tsx

src/hooks/useInvoice.ts
```

Plus a tiny migration to:
- Add `bank_instructions` jsonb (routing, account, memo) to `companies`.
- Seed the 4 preset `invoice_templates` rows (`company_id = NULL`, `kind = 'preset'`).
- Add a nav link to `/invoices` in `AppSidebar`.

## Build order

1. Migration (preset templates + `companies.bank_instructions`).
2. `stripe.server.ts` + webhook handler + `createInvoiceCheckout` fn.
3. Invoice list + editor + line-item search/custom + record-payment dialog (full internal flow).
4. `invoice-pdf.ts` + 4 preset templates rendering.
5. AI template designer (Gemini 2.5 Pro + strict JSON schema).
6. Public `/pay/$token` page with Stripe button (card/Link/ACH all work via one Checkout Session).
7. PayPal — once you give the word, I'll request the 3 secrets and add the button + webhook.

## How to test in the preview

1. **Pick this job** (already loaded: `4debbc0e-…`) → click **Create invoice** → choose "Use approved contract price" → editor opens with one line item totaling the contract amount.
2. Add a custom line: "Extra gutter run, 40 LF, $12/LF" → save.
3. Click **Preview & Send** → "Copy public pay link" → open in incognito tab.
4. On the public page, click **Pay with Card**, enter Stripe test card **`4242 4242 4242 4242`**, any future expiry (e.g. `12/34`), any CVC (e.g. `123`), any ZIP. Submit.
5. Stripe redirects back. Webhook fires within ~1 sec → invoice status flips to **paid**, `amount_paid` matches.
6. Test partial: create another invoice for $1000 → on public page change amount to $300 → pay → status becomes **partial**, `amount_due = $700`.
7. Test ACH: same flow, pick "US bank account" → use Stripe's test routing `110000000` and account `000123456789`. Auto-verifies in test mode.
8. Test manual: open invoice → **Record payment** → "Check #1234, $200, today" → status updates to **partial** or **paid**.
9. Test AI template: open editor → template picker → **Design with AI** → "navy blue, white background, big logo top-left, monospace prices, no border on table" → preview updates → save → set as default → export PDF.

When you're ready for PayPal, say the word and I'll request the 3 secrets and wire the button.
