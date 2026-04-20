

## Goal

Two things, in this order:

1. **Right now**: Hand the user a clean **Excel file** of the 200+ line items extracted from the Xactimate PDF they just uploaded, so they can drop it into the existing **Pricing → Upload estimate file** flow today and finish.
2. **Going forward**: Fix the PDF endpoint so a real Xactimate like this one extracts cleanly on the first drop — no manual conversion needed.

## Why the PDF upload errored on this file

The PDF parses perfectly into 18 pages of standard tables (DESCRIPTION / QTY / REMOVE / REPLACE / TAX / TOTAL). The problem is the AI extraction prompt:

- It requires every row to have a **`code`** (Xactimate selector like "RFG 240").
- This Xactimate PDF labels rows by **line number** ("9. R&R 1/2\" drywall…", "104. R&R Ridge cap…") — there is no separate selector column. Gemini either invents shaky codes or skips rows, then the `< 5 items` guard or the `code+description` schema validation kills the response.
- It also caps the response at one Gemini turn, so a 280+ item estimate gets truncated.

## Step 1 — Immediate deliverable (no app changes)

Run a local Python script against the PDF you uploaded:
- Walk every page's table, pull DESCRIPTION / QTY / unit / REMOVE / REPLACE / TOTAL.
- Auto-assign a Category from the section header (Main Level, Roof1, Exterior, etc.).
- Build a synthetic Code from line number + first letters of category (so the wizard's "code is required" check passes).
- Write `Final_Draft-2026-04-17-104804-line-items.xlsx` to `/mnt/documents/` and present it as a `<lov-artifact>`.

You then go to **Pricing → Upload estimate file**, drop that .xlsx, the existing spreadsheet path (which is rock-solid) auto-maps every column, and you save. **You finish today.**

## Step 2 — Permanent fix to the PDF endpoint

Edit `src/routes/api.parse-xactimate-pdf.ts`:

1. **Loosen the schema** — make `code` optional. When the AI doesn't return one, derive it server-side from `category + line index` (e.g. `RFG-104`, `MAIN-9`).
2. **Strengthen the prompt** — tell Gemini explicitly: "Xactimate items are numbered; if there's no selector code, return the line number; the Description is the text after `N. `; Unit comes from QTY column (e.g. `1.00 SQ` → `SQ`); unit_price = the larger of REMOVE / REPLACE / (TOTAL ÷ qty). Process every page."
3. **Drop the `< 5 items` hard error** to a soft warning passed back to the client (so partial extractions still load and you can hand-fix instead of getting a dead end).
4. **Increase max tokens / use `google/gemini-2.5-pro`** (already set) and explicitly request "do not stop until every line item from every page is returned."

Edit `src/components/pricebook/UploadParseStep.tsx`:
- When the API returns rows + a soft warning, show "Extracted N items (warning: …)" instead of red-erroring out.

## Files touched in Step 2

- `src/routes/api.parse-xactimate-pdf.ts` — schema, prompt, error tiers.
- `src/components/pricebook/UploadParseStep.tsx` — surface partial-success warnings.

No DB changes. No new dependencies. Step 1 unblocks you immediately; Step 2 makes the next Xactimate PDF you drop "just work."

## Result

- You get the .xlsx of this estimate's line items in this same response and can publish your master pricing today.
- After Step 2 ships, dropping a Xactimate PDF on Pricing → Upload estimate file extracts the full item list reliably, even when the file uses line-number labeling instead of selector codes.

