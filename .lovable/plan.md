# Prospector rename + Follow-Up tab + Training scroll fix

## 1. Rename "Lead Management Center" → "Prospector"

Routes stay at `/leads/*` so existing links/bookmarks keep working — only visible labels change.

- `src/routes/_app.leads.tsx` — H1 "Lead Management Center" → "Prospector".
- `src/components/layout/AppSidebar.tsx` — sidebar item "Lead Mgmt Center" → "Prospector".
- `src/components/layout/MobileSidebarSheet.tsx` — same rename.

## 2. Fix Training Center scrolling / cut-off content

Root cause: `src/routes/_app.leads.training.tsx` wraps the layout in a `maxHeight: 85vh` + `overflow-hidden` grid, with the right pane as the only scrollable region. Inside the app shell that traps content and clips the bottom (and on shorter viewports the inner scroll never reaches the last sections).

Fix: drop the height cap so the page scrolls normally; make the category sidebar sticky on desktop so it stays visible while reading.

- Remove `overflow-hidden` and `maxHeight: 85vh` from the grid wrapper.
- Sidebar `<nav>`: `self-start lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto` (still scrollable internally if it ever overflows; on mobile it just stacks naturally).
- Right content pane: remove `overflow-y-auto` so all sections render in normal page flow.

## 3. Add a "Follow-Up" tab

A list of leads that have been spoken to AND received a free damage / savings report by email or text. Source of truth: `lead_activities.type = 'report_sent'` (enum already exists).

### Tab + route

- `src/routes/_app.leads.tsx` — add a `Follow-Up` tab between Savings and Training, lucide icon `Send`.
- `src/routes/_app.leads.followup.tsx` — new page.

### Page layout

- KPI strip: Reports sent (total), This week, Awaiting reply (no `call`/`email`/`text`/`note` activity after the latest `report_sent`), Converted (status moved to qualified/quoted/won after report).
- Filter bar: channel (Email / Text / All), status, date range, search by name/address.
- Table: Lead (name + address, click → opens existing `LeadDetailSheet`), Channel badge, Sent at, Days since, Last reply, Status badge, Actions (Log call, Mark contacted, Open lead).
- Empty state: "No reports sent yet — generate a savings or damage report and send it to a contact to start tracking follow-ups here."

### Server function

`listFollowUps` in `src/server/leads.functions.ts`:
- Query `lead_activities` where `type = 'report_sent'`, joined to `leads` (RLS already scopes via the existing "Access activities via lead" policy).
- Group by lead → return latest `report_sent` (with parsed channel), follow-up activity count, latest reply timestamp, and the lead row.

### Logging "report sent" (so the tab populates)

Today nothing writes `report_sent`. Add send actions on the Savings page:

- New `src/server/lead-reports.functions.ts` → `sendLeadReport({ leadId, contactId, channel: 'email'|'text', reportId })`:
  - Email: Resend (secret already set) — sends a signed URL to the PDF in the `lead-reports` bucket.
  - Text: gated. If no SMS provider is configured, the button is disabled with tooltip "SMS provider not configured" and we still ship the email path. Open question below.
  - Inserts `lead_activities { type: 'report_sent', note: 'email→john@x.com' | 'text→+15551234' }` and bumps lead `status` from `new` → `contacted`.
- `src/routes/_app.leads.savings.tsx` — after the existing PDF generation, add "Email to contact…" / "Text to contact…" buttons. A small dialog picks from the lead's `lead_contact_emails` / `lead_contact_phones`, then calls `sendLeadReport`.

## Technical details

- No schema migrations required — `lead_activity_type` already includes `report_sent`, and `lead_reports` already stores PDF metadata.
- Channel parsing: store as a stable prefix in `lead_activities.note` (`email→…` / `text→…`) so the Follow-Up query can derive channel without a schema change. Easy to promote to a real column later.
- Server functions follow the existing `createServerFn` pattern with Zod input + `auth_company_id()` scoping.
- Follow-Up page uses TanStack Query with key `['followups', filters]`, matching the other leads tabs.

## Open question

For the SMS channel: do you already have a provider you want to use (Twilio, Telnyx, etc.), or should I ship Email-only now and leave the Text button disabled until you pick a provider?
