## Goal

Collapse the AI Roof Wizard and Savings Report into a single guided flow inside the lead detail sheet. Remove their top-level tabs. Once a report is generated, save it to the lead, mark the lead as `report_sent`, and surface it in the Follow-Up tab automatically.

## Tab cleanup (`src/routes/_app.leads.tsx`)

Remove the `AI Wizard` and `Savings` tabs. Final tab order:
Dashboard · Map · List · Pipeline · Follow-Up · Training. Keep Import as a button on the List page (it already lives at `/leads/import` — change List page to render an "Import addresses" button that links there, and drop the standalone Import tab too).

Keep `_app.leads.wizard.tsx` and `_app.leads.savings.tsx` files around but unlinked, so existing deep-links and the in-sheet flow can still reuse their logic during transition. (Code from both is folded into the new in-sheet experience over time; they remain reachable but are no longer in the nav.)

## New in-sheet workflow (`src/components/leads/LeadDetailSheet.tsx`)

Replace the current "AI Roof Wizard" + "Generate Savings Report" + "Save quick PDF" buttons with a single 3-step inline flow under the existing Satellite View section:

```text
Satellite View (existing 192px static map)
─────────────────────────────────────────
Step 1 · Drop pins on each roof  [interactive map, zoom/pan]
        • Pin list with status dots, "Clear all"
Step 2 · Get measurements        [button → /api/solar-roof-extract]
        • Shows total sqft, avg pitch, sun hrs, segments
Step 3 · Run analysis            [button → analyzeRoofWithAI]
        • Shows AI text + image
        ↓ on success, auto-opens
[Report Builder modal]  ← reuses SavingsReport body
        - editable sqft / roof type / age / address
        - Export PDF (saves to lead-reports + marks report_sent)
        - Send to Owner (email/text — opens compose, logs report_sent)
```

Implementation:
- Replace the read-only static Mapbox map with the interactive wizard map (port the init/click/markers logic from `_app.leads.wizard.tsx` into a new `<RoofWizardInline lead={lead} />` component in `src/components/leads/RoofWizardInline.tsx`). Pins persist to `leads.ai_report.measurements.pins` so they survive sheet reopen.
- The "Get measurements" and "Run analysis" buttons reuse the existing fetch + `analyzeRoofWithAI` logic from the wizard route. Results render in the same sheet (no navigation away).
- After analysis succeeds, open a new `<ReportBuilderDialog />` (extracted from `_app.leads.savings.tsx` as `src/components/leads/ReportBuilderDialog.tsx`) pre-filled with the lead, measurements, and AI observations. Inputs stay editable.
- Dialog "Export as PDF" generates the PDF, uploads it to the `lead-reports` bucket, inserts into `lead_reports`, then logs a `report_sent` activity, sets `lead.status = 'report_sent'`, and toasts "Report saved & lead moved to Follow-Up".
- "Send to Owner" opens a `mailto:` / SMS link with the report download URL prefilled and logs `report_sent` with the recipient (`email → owner@x` or `text → +1…`) so it appears in Follow-Up with the right channel.

## Auto follow-up

`listFollowUps` already keys off `lead_activities.type = 'report_sent'`, so the dialog's existing log call is enough — once a report is exported the lead shows up in Follow-Up automatically. No DB schema changes required.

## Files touched

- `src/routes/_app.leads.tsx` — remove Wizard / Savings / Import tabs
- `src/components/leads/LeadDetailSheet.tsx` — replace static map + 3 action buttons with the inline wizard + report dialog
- `src/components/leads/RoofWizardInline.tsx` — new (extracts pin/measure/analyze logic from `_app.leads.wizard.tsx`)
- `src/components/leads/ReportBuilderDialog.tsx` — new (wraps the savings report body in a Dialog with PDF export + status update)
- `src/routes/_app.leads.list.tsx` — add "Import addresses" button linking to `/leads/import`

No DB migrations.
