
# Plan: Profile cleanup, job wipe, invoicing + payments

## Part 1 — Cleanup (one-time data work)

### 1a. Merge Jared profiles
- Canonical: `e728ce16-ccdb-437e-ab2a-0810312e189d` (auth email `jaredjjanacek@gmail.com`, last sign-in May 13, owns 1,258 leads + 67 photos).
- Reassign every FK on the duplicate `7af929a0-e652-4fd4-a1b1-a67c0f05e0e1` (`jared@globalcontractor.network`) to the canonical id across: `leads.created_by/assigned_to`, `jobs.created_by/assigned_to`, `lead_activities.user_id`, `lead_notes.user_id`, `lead_documents.uploaded_by`, `lead_reports.created_by`, `job_photos.uploaded_by`, `job_property_analyses.created_by`, `generated_reports.created_by`, `estimates`, `contracts.rep_user_id`, `job_order_*` actor/created_by/approved_by columns, `audit_log.actor_user_id`, `company_invites.invited_by`, `company_join_requests.user_id/decided_by`, `ai_measurement_runs.reviewed_by/user_id`.
- Delete the duplicate `profiles` row, then delete `auth.users` row for `7af929a0`.
- Log the merge in `audit_log`.

### 1b. Wipe ALL test jobs
Delete every row in `jobs` and cascade-clean dependent rows (in this order to respect FKs):
`estimate_line_items` → `estimates` → `job_order_history` → `job_order_snapshots` → `job_order_drafts` → `job_property_analyses` → `job_photos` (+ delete underlying objects in `roof-photos` storage) → `contracts` (+ generated PDFs in `contracts` bucket) → `generated_reports` (+ `generated-pdfs`) → `ai_measurement_runs` tied to jobs → `jobs`.
Leads, clients, companies, price books, catalog all preserved.

## Part 2 — Invoicing module

### 2a. Schema (new tables)
- `invoice_templates` — `id, company_id, name, kind ('preset' | 'ai'), layout jsonb (sections, colors, font, logo placement, terms, footer), preview_url, is_default, created_by, timestamps`. RLS: company members manage own; super_admin all.
- `invoices` — `id, company_id, job_id (nullable), client_id (nullable), template_id, invoice_number (auto via per-company sequence), status (`draft|sent|partial|paid|void|overdue`), issue_date, due_date, currency, notes, terms, subtotal, discount, tax_pct, tax, total, amount_paid, amount_due, pdf_path, sent_at, created_by, timestamps`.
- `invoice_line_items` — `id, invoice_id, sort_order, kind ('catalog'|'custom'), line_item_master_id (nullable), name, description, qty, unit, unit_price, total`.
- `invoice_payments` — `id, invoice_id, company_id, method ('stripe'|'paypal'|'cash'|'check'|'ach'|'other'), amount, currency, status ('pending'|'succeeded'|'failed'|'refunded'), provider_id (Stripe PaymentIntent / PayPal capture id), provider_meta jsonb, paid_at, recorded_by, timestamps`.
- Trigger to auto-roll `invoice.amount_paid`, `amount_due`, and `status` whenever `invoice_payments` changes.
- Trigger for per-company `invoice_number` (e.g. `INV-2026-0001`).

### 2b. UI (new routes under `_app`)
- `/invoices` — list, filter by status/client/job, search.
- `/invoices/new` — picker: standalone OR from a job (pre-fills client + line items from approved order snapshot/estimate).
- `/invoices/$id` — editor:
  - Header: company logo, name, address, phone, email, license #s (from `companies`); customer block (from `clients`); job link.
  - Template picker (preset list + "Design with AI") — sets `template_id`.
  - Line items table with two add modes:
    1. **Search catalog** — combobox over `line_item_master` (mirrors `AddLineItemCombobox.tsx`).
    2. **Custom line item** — name / desc / qty / unit / unit price.
  - Discount, tax %, notes, terms.
  - Totals panel: subtotal, discount, tax, total, paid, balance due.
  - Actions: Save draft · Preview PDF · Send (email via Resend, attach PDF) · Record payment · Charge card (Stripe) · Charge with PayPal · Mark void.
- `/invoices/$id/pay` — public-ish payment page (token-gated link the customer receives) showing balance + Stripe Card Element + PayPal button.

### 2c. AI templates
- **Preset gallery** (4 layouts): Classic, Modern, Minimal, Bold. Each is a JSON layout schema with section order, font pair, accent color, logo placement.
- **"Design with AI"** dialog: prompt + tone + accent color → calls `createServerFn` `generateInvoiceTemplate` which uses Lovable AI (Gemini 2.5 Pro) with a strict JSON schema → stored as a new `invoice_templates` row with `kind = 'ai'`. Free-form HTML is NOT used — AI fills the same layout schema so PDF rendering stays predictable.
- PDF generated server-side from the layout schema (reuses jsPDF approach already in `src/lib/pdf-generator.ts`/`lead-report-pdf.ts`).

### 2d. Payments
- **Stripe** (built-in seamless Lovable Payments): enable via `payments--enable_stripe_payments` after running `payments--recommend_payment_provider`. Use Stripe Checkout / PaymentIntents for card + Apple/Google Pay + ACH. Server fn `createInvoiceCheckout` returns a hosted URL or PaymentIntent client secret. Webhook at `/api/public/webhooks/stripe` verifies signature, looks up invoice via `client_reference_id`, inserts a row into `invoice_payments` with `method='stripe'` and `status='succeeded'`.
- **PayPal** (BYO credentials): user provides REST API client id + secret (added via `add_secret`). Server fns `createPayPalOrder` and `capturePayPalOrder` hit the PayPal REST API; webhook at `/api/public/webhooks/paypal` (signature-verified) records captures into `invoice_payments`.
- **Manual**: "Record payment" dialog (cash/check/ACH/other) inserts into `invoice_payments` directly.

### 2e. Sidebar + nav
Add "Invoices" entry to `AppSidebar.tsx` with a receipt icon, between Jobs and Settings.

## Order of execution
1. Confirm plan → run cleanup migration (Part 1a + 1b) in one transaction.
2. Run invoicing schema migration (Part 2a).
3. Recommend + enable Stripe (built-in).
4. Request PayPal credentials via `add_secret`.
5. Build UI: list → editor → template picker → AI generator → payment flows → public pay page.
6. Wire webhooks, test end-to-end with Stripe test cards and PayPal sandbox.

## Notes
- All work scoped by `company_id = auth_company_id()`; super_admin policies mirror existing tables.
- Reusing existing patterns: `AddLineItemCombobox`, `useCompany`, `lead-report-pdf.ts`, snapshot-style server functions.
- Public pay page lives at `/api/public/pay/$token` (signed token, no auth required).
