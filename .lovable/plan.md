

## Goal

Let users upload a Xactimate PDF (or Excel/CSV) **immediately**, without filling out any metadata first.

## Root cause

Right now `/price-books/new` is a 3-step wizard where **Step 1 = metadata** (Name, Jurisdiction, Effective Month, ≥1 ZIP). The upload box doesn't even appear until those four fields are filled. From a user point of view, it looks like “the system won’t let me upload a PDF.”

The PDF extraction endpoint (`/api/parse-xactimate-pdf`), the `unpdf` parser, the AI gateway key, and the file-size guard are all wired up correctly — extraction works once the file actually reaches Step 2.

## Plan

### 1) Reorder the wizard: Upload first, details second
Swap the steps so the flow is:

1. **Upload & Extract** — drop the Xactimate PDF / Excel / CSV. Extraction runs immediately. User sees “Extracted N line items.”
2. **Details** — Name, Pricing Type, Jurisdiction, Effective Month, ZIPs (with smart defaults pre-filled from the file: e.g., name = file name without extension, effective month = current month).
3. **Review & Save** — same as today, with the “Save N line items” button.

This removes the perceived block — the dropzone is the very first thing users see when they click “Upload estimate file.”

### 2) Soften the metadata requirements
- **Name**: required (default = filename minus extension).
- **Pricing Type**: required (default = `insurance`).
- **Jurisdiction**: optional. If empty, save as `null`.
- **Effective Month**: optional. Default to the current month.
- **ZIP codes**: optional. Empty array is fine.

This way, even if users skip every field on Step 2, they can still save a pricing library from a PDF.

### 3) Update the page header + helper text
- Header stays “Upload Estimate File.”
- Subtext changes to: “Drop your Xactimate PDF and we’ll extract every line item — you can name and tag it after.”
- Step labels become: **Upload & Extract → Details → Review & Save**.

### 4) Same change in the admin upload page
`admin.price-books.new.tsx` has the identical 3-step wizard for master pricing uploads. Apply the same reordering + softened metadata there so admins get the same flow.

### 5) Keep all extraction logic intact
- `/api/parse-xactimate-pdf` — unchanged.
- `xactimate-parser.ts` — unchanged.
- `MatchConfirmStep` — unchanged.
- `UploadParseStep` — unchanged.

No backend changes, no migrations.

## Files to edit

- `src/routes/_app.price-books.new.tsx` — reorder steps; relax `canNext1` → now applies to the Details step which becomes Step 2; auto-fill metadata defaults from the parsed file.
- `src/routes/admin.price-books.new.tsx` — same reorder + relaxed validation.
- `src/components/pricebook/MetadataStep.tsx` — drop the “required” feel from Jurisdiction / Effective Month / ZIP labels (small copy tweak); leave logic intact.

## Result

The user opens **Pricing → Upload estimate file**, immediately sees a drop zone, drops their Xactimate PDF, the AI extracts line items in 10–30 s, then they fill in (or accept the defaults for) Name / Jurisdiction / ZIPs, review the rows, and save.

