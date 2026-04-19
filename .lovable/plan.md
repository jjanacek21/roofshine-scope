

## Summary

Three distinct changes:
1. **Fix the company-side upload** that still fails (root cause: company route blocks if storage upload fails — needs the same best-effort wrap admin already has, plus PDF flow needs verification).
2. **Rebrand "Price Books" → "Pricing"** with two clear sub-tabs: **Insurance** (Xactimate uploads) and **Retail** (master macros + per-company pricing).
3. **Wire photo uploads → automatic AI analysis → estimate suggestions** so a brand-new user can just take photos and watch line items appear.

---

## 1) Fix the upload (true root cause)

The admin route was already made best-effort, but `_app.price-books.new.tsx` (the company-side wizard the user is on right now per the route header `/price-books/new`) still **throws and aborts** if `xactimate-uploads` storage fails. RLS on that bucket only allows path prefix = `company_id`, which works in theory but silently breaks for any edge case (file name with characters, etc.). Fix:

- Wrap the storage upload in try/catch (same pattern as admin route). If it fails, log a warning toast and continue creating the price book + line items. Source-file storage is not required for the data to be useful.
- Also surface the **actual** Supabase error message in toasts (today some paths still show generic "Upload failed").
- Confirm `unpdf` PDF parsing works server-side (already in place after last loop) and that `MetadataStep`'s required fields (`name`, `jurisdiction`, `effective_month`, ≥1 zip) aren't silently blocking the user. Add a small helper text on the Next button explaining what's missing if disabled.

---

## 2) Rename **Price Books → Pricing**, split into Insurance + Retail

### Renames (cosmetic only — keep URLs `/price-books` to avoid breakage)
- Sidebar label, Topbar label, page H1, admin sidebar label all become **Pricing**.
- Empty-state copy + helper text updated.

### New tab structure on `/price-books` (company side)
```
Pricing
├── Insurance ← Xactimate uploads (existing flow)
└── Retail    ← Master Macros + per-company pricing
```

Add a `<Tabs>` at the top of `_app.price-books.tsx` using existing `pricing_type` filter on `price_books`. Each tab shows only books of that type and gets its own "Upload" button.

### Master Macros (new concept, per the user's request)

Macros are **bundles of line items + quantities** that any company can pick from and override prices on. Per the user's Q1 answer ("Both"), we support:
- **Bundle macros** — e.g. "Asphalt Reroof — 25 sq" containing several `line_item_master` codes with default quantities.
- **Single-item template macros** — one reusable item with placeholder price.

#### Schema (new tables, migration)
```
master_macros (
  id, name, description, trade, category, is_default boolean,
  company_id null = master, created_by, created_at, updated_at
)
master_macro_items (
  id, macro_id → master_macros, line_item_master_id → line_item_master,
  qty numeric, unit text, sort_order int
)
company_macro_pricing (
  id, company_id, macro_id, line_item_master_id,
  unit_price numeric, notes text, updated_at
)
```
RLS: master macros (`company_id IS NULL`) readable by everyone; `is_super_admin()` manages master rows. `company_macro_pricing` scoped to `auth_company_id()`.

#### UI
- **Admin → Pricing → Macros** tab: super admins create master macros (name + add line items from `line_item_master` + qty).
- **Company → Pricing → Retail tab**: shows master macros as cards with "Set my prices" button → opens a panel listing the macro's line items with editable price inputs (saved to `company_macro_pricing`).
- **In the Estimate**: add an "Insert macro" button next to "Add line item" that opens a picker of macros; selecting one inserts all its line items at once with the company's prices (falling back to master `default_price`).

---

## 3) Photo Analyzer → Auto-suggest line items

### What works today
- `/api/analyze-job-photos` already exists, takes a `photo_id`, runs Gemini 2.5 Pro, writes `ai_analysis` + `matched_line_items` to `job_photos`.
- "Add suggestions to estimate" button exists in the Lightbox and PhotoCard.

### What's missing
- **Auto-trigger** — currently the user must click "Analyze" per photo or "Analyze all". After upload it should fire automatically.
- **Auto-add to estimate** — even after analysis, the user must click "Estimate" per photo. The user wants the estimate to populate without manual clicks.
- **Quantity guesses** — current `observed_items` returns `suggested_qty` sometimes but the estimate insert path (`addCodes` in estimate.tsx) ignores qty and inserts as `qty: 1`.

### Plan

**a) Auto-analyze after upload** (`PhotoUploader.tsx` + `JobPhotosPanel.tsx`)
- After `useMutation` insert succeeds, fire `/api/analyze-job-photos` for each new photo (don't await — fire-and-forget with toast "Analyzing N photos…"). On completion, invalidate the photos query.

**b) Add a per-job "Auto-add AI suggestions to estimate" toggle** (per Q2 answer "Both options")
- New column on `companies`: `auto_add_photo_suggestions boolean default false`.
- Settings → Estimating gets a switch.
- When ON: after analysis, auto-call a new server fn `addPhotoSuggestionsToActiveEstimate(jobId)` that:
  - Finds the latest `estimates` row for the job.
  - Pulls all `matched_line_items` across `job_photos` for the job.
  - Resolves each `suggested_code` against `line_item_master` (company-scoped or master fallback).
  - Inserts as `estimate_line_items` with `qty = suggested_qty ?? 1`, marking them with a tag like `source: 'ai_photo'` so they can be highlighted as drafts.
- When OFF: existing review-then-add flow (per Q2's "Both"). Add a "Review AI Suggestions" panel at the top of the estimate page showing pending suggestions across all photos with bulk "Approve all" / "Approve & insert" / "Dismiss".

**c) Improve the AI prompt** in `api.analyze-job-photos.ts`:
- Pull both company-trade-filtered and master fallback catalog rows (today only company catalog).
- Ask the model to **always** return `suggested_qty` (estimating from photo dimensions/coverage when unsure, with `confidence: low`).
- Tighten the system prompt for residential restoration: explicitly call out roof slopes, wall sections, water-damaged drywall sqft estimation, etc.

**d) Estimate insertion path**
- Modify `addCodes` (estimate route) to accept `Array<{ code, qty }>` instead of just `string[]`.
- Add a flag on `estimate_line_items` to indicate AI-suggested origin (new column `source text default 'manual'`) so the line-item table can show a "✨ AI" chip next to those rows.

---

## Out of scope
- OCR for image-only Xactimate PDFs (still requires the text layer).
- Mobile camera-roll bulk processing.
- Confidence-scored auto-pricing (suggested qty stays as a guess; user adjusts).
- Re-running AI when a photo is replaced (re-analyze button already exists).

---

## Files touched
**Migrations (new):**
- `master_macros`, `master_macro_items`, `company_macro_pricing` tables + RLS
- `companies.auto_add_photo_suggestions boolean`
- `estimate_line_items.source text default 'manual'`

**New:**
- `src/routes/_app.macros.tsx` (or a Retail tab inside `_app.price-books.tsx`)
- `src/routes/admin.macros.tsx` (master macro authoring)
- `src/components/estimate/MacroPicker.tsx`
- `src/components/estimate/AISuggestionsPanel.tsx`

**Edited:**
- `src/components/layout/AppSidebar.tsx`, `Topbar.tsx` — rename label
- `src/routes/_app.price-books.tsx` — add Insurance/Retail tabs
- `src/routes/_app.price-books.new.tsx` — best-effort storage + better error toasts
- `src/components/jobs/PhotoUploader.tsx` — auto-trigger analyze
- `src/components/jobs/JobPhotosPanel.tsx` — drive auto-flow + auto-add toggle
- `src/routes/_app.jobs.$id.estimate.tsx` — accept qty in addCodes, render AI panel, source chip
- `src/routes/api.analyze-job-photos.ts` — broader catalog, qty-required prompt
- `src/routes/_app.settings.tsx` — auto-add toggle

