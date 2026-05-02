## Includes the previously approved work

1. Collapsible sidebar with Admin links moved into a popover off the user chip at the bottom.
2. New `Do Not Contact` (dead lead) status added to the lead status enum, badges, pipeline columns, and filters.
3. Batch select + bulk delete on the Leads → List page (with confirm dialog).

The items below are added on top.

---

## 4. Fix "No coordinates available" satellite view

Currently 216 of 291 leads have no `lat`/`lng`, so the detail sheet shows the placeholder. Fix it on two fronts:

**a. On-demand geocoding when a lead is opened**
- New server function `geocodeLead({ leadId })` in `src/server/leads.functions.ts`:
  - Auth-gated via `requireSupabaseAuth`.
  - Loads the lead, builds `"<address>, <city>, <state> <zip>"`, calls Mapbox geocoding (`MAPBOX_API_TOKEN` already configured), updates `leads.lat/lng`, writes a `lead_activities` row of type `ai_analysis` with note `"Geocoded address"`.
  - Returns `{ lat, lng }` or `{ lat: null, lng: null }` if geocoding fails.
- In `LeadDetailSheet`, when the lead has no coords, automatically call `geocodeLead` once and re-render. Show a small "Locating address…" spinner instead of the static placeholder. If it fails, fall back to the current message plus a manual "Try again" button.

**b. Backfill button**
- Add a small "Locate all missing addresses" button on Leads → Map (admins only). Calls a new `backfillGeocodes()` server function that processes up to ~50 missing leads per click (rate-friendly).

## 5. Generate Report button + savings/damage report wizard

- In `LeadDetailSheet`, under the satellite view, add a primary `Generate Report` button.
- Clicking opens the existing Savings Report flow inline as a dialog (refactor of `_app.leads.savings.tsx` body into a reusable `SavingsReportWizard` component). The wizard pre-fills `sqft` and address from the lead.
- Wizard steps: Inputs → Preview → Save & Generate.
- "Save & Generate" creates the PDF (reusing the existing `jsPDF` flow), uploads to a new private storage bucket `lead-reports`, and inserts into a new table `lead_reports` (see Technical notes). Auto-logs an activity `report_generated` with the report name.
- The newest report is shown in a new "Reports" section in the detail sheet with a download link and a "Delete" button (admin only).

## 6. Email/Text with optional attachments + auto-status change

When the user clicks `Email` or `Text` in the detail sheet:
- Open a new `SendMessageDialog` instead of the current bare `mailto:` action.
- Dialog shows:
  - To: pre-fills the lead's primary email or phone (editable; lists all available contacts to pick from).
  - Subject + Body (basic editor, with a default template per channel).
  - **Attachments** section listing:
    - The latest generated report (auto-checked).
    - Older reports (if any).
    - Any uploaded photos / documents tied to the lead (see new `lead_documents` table below).
  - Send button.
- Sending uses a new edge function `send-lead-message` (modelled after `send-invite-email`, uses `RESEND_API_KEY` for email; SMS is logged-only for now with a clear note in the UI — Twilio is not configured).
- After a successful send:
  - Insert `lead_activities` row of type `email` or `text` with the subject + recipient + attachment count.
  - If at least one report was attached, set lead status to a new `report_sent` status and log a `status` activity.

## 7. Lead documents/photos uploads

- New `lead_documents` table (storage-backed; used both for report attachments and ad‑hoc uploads).
- New "Files" section in the detail sheet: drag-and-drop or click-to-upload (images/PDFs). Files appear with thumbnails and become available as attachment options in `SendMessageDialog`.

## 8. Activity tracker — every action time-stamped + user attributed

- Today only some actions log to `lead_activities`. Standardize and extend so every meaningful action writes an activity row with `user_id`, `created_at`, `type`, and a human-readable `note`. Tracked actions:
  - Lead created (import or manual)
  - Status changed (from → to)
  - Note added
  - Call / Email / Text initiated
  - Email/Text actually sent (separate from "initiated")
  - Report generated / deleted
  - Document uploaded / deleted
  - Lead geocoded
  - Lead deleted (logged before delete)
- Update `app_user` enum: extend `lead_activity_type` with values `report_generated`, `document_uploaded`, `document_deleted`, `lead_created`, `lead_deleted`, `report_sent`.
- Activity panel in detail sheet groups by day and shows the user's name (joined via `profiles`) and timestamp. Add a `useLeadActivities` extension to fetch the user names in one query.

## 9. Admin-only delete

- Database: tighten the existing `Company admins delete leads` RLS so only owners/admins can delete (current policy already requires `is_company_admin()` — confirmed correct, no change needed).
- UI: hide the bulk-delete and per-row delete buttons for non-admin users using `useProfile` role check.
- Server function `bulkDeleteLeads({ ids })` validates admin role server-side as well, and writes a `lead_deleted` activity for each before deletion.

---

## Technical notes

**New tables (single migration):**

- `lead_status` enum: add `dnc` and `report_sent`.
- `lead_activity_type` enum: add `report_generated`, `report_sent`, `document_uploaded`, `document_deleted`, `lead_created`, `lead_deleted`.
- `lead_reports` table: `id`, `lead_id`, `company_id`, `created_by`, `kind` (`savings`|`damage`), `name`, `pdf_path` (storage), `inputs jsonb`, `created_at`. RLS via lead → company.
- `lead_documents` table: `id`, `lead_id`, `company_id`, `uploaded_by`, `name`, `mime_type`, `size_bytes`, `storage_path`, `kind` (`photo`|`document`), `created_at`. RLS via lead → company.
- New private storage buckets: `lead-reports`, `lead-documents`. RLS scoped to the user's company via path prefix `<company_id>/<lead_id>/...`.

**New / changed server functions (`src/server/leads.functions.ts`):**
- `geocodeLead`, `backfillGeocodes`, `bulkDeleteLeads`, `generateLeadReport` (records the row after the client uploads), `sendLeadMessage` wrapper (or direct edge function call).

**New edge function:** `send-lead-message` — mirrors `send-invite-email`, accepts `{ lead_id, channel, to, subject, body, attachments: [{ bucket, path, name }] }`, fetches signed URLs for attachments, sends via Resend, returns success.

**LeadDetailSheet refactor:** broken into smaller components — `LeadSatellite`, `LeadActions`, `LeadReports`, `LeadDocuments`, `SendMessageDialog`, `SavingsReportWizard` (extracted from `_app.leads.savings.tsx`, which still works as a standalone page).

**SMS note:** Twilio isn't configured. The Text action will compose the message and log activity, but actually sending SMS is stubbed pending a Twilio (or similar) API key. I'll surface this clearly in the UI.

## Out of scope

- Real SMS delivery (need Twilio key — happy to add when you say so).
- Inline rich-text email editor — using a basic textarea with a default template.
- Damage report PDF differs from savings report only in label/template; both share the wizard. A fully separate damage workflow can come later.
