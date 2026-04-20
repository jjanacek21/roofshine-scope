

## Why "Add to estimate" silently does nothing

Confirmed by reading the data: your URL right now is `?codes=RFG_SHNG_A,RFG_HIP,RFG_FELT_S`. None of those codes exist in your `line_item_master` (your catalog uses Xactimate-style codes like `EXTE-160`, `RFG-220`, etc.). The flow:

1. Property analysis panel sends `?codes=RFG_SHNG_A,...` to the estimate page.
2. Estimate page calls `addCodes(...)`, which does `line_item_master.in("code", codes)`.
3. Zero matches → fires a tiny `toast.warning("Codes not found in catalog")` and inserts nothing.

So the AI-suggested rows are getting thrown away entirely — including the fully-resolved description, qty, unit, and unit price the server already computed.

## Fix — two changes, no DB work

### 1) Stop routing AI suggestions through a URL + catalog-lookup roundtrip

In `src/components/jobs/PropertyAnalysisPanel.tsx`, replace `addAll`'s "navigate to `/estimate?codes=...`" with a direct insert into the active estimate using the data we already have on the client (description, qty, unit, unit_price, catalog_name, catalog_trade — all returned by `/api/analyze-property`). Steps:

- Look up the active estimate for the job (`estimates` table, latest by `created_at`, scoped to `job_id`).
- If none exists, create one (mirroring the auto-create the estimate page does today).
- Build one `estimate_line_items.insert([...])` call with rows that look like:
  - `code`: the catalog code if it matched (`catalog_name != null`), otherwise `null`
  - `name`: `catalog_name` if matched, otherwise `description`
  - `trade`: `catalog_trade` if matched, otherwise `job.primary_trade ?? "general"`
  - `unit`, `qty`: from the AI item
  - `unit_price`: from the AI item (null → 0)
  - `total`: `qty * unit_price`
  - `source`: `"ai_property"`
  - `sort_order`: appended after current items
- On success: invalidate `["estimate-items", estimateId]`, toast `"Added N items"`, then navigate to `/jobs/$id/estimate` so the user sees them.
- Surface a subtle subline in the toast when some items had no catalog match: `"3 added · 2 inserted as custom (no catalog match)"`.

This means **every selected suggestion gets added**, whether or not the AI invented a catalog code. The user no longer loses work to a silent string mismatch.

### 2) Tighten the AI's catalog grounding so this happens less often

In `src/routes/api.analyze-property.ts`, change the prompt and tool schema so the AI is much more constrained:

- Add an explicit instruction: *"Choose `suggested_code` ONLY from the CATALOG list. If no catalog code reasonably fits, omit the field — do NOT invent codes."*
- After parsing, on the server: drop `suggested_code` whenever it doesn't match a catalog row. The client then knows `code === undefined` means "insert as custom item with the AI's description."
- (Already in place) The server returns `catalog_name` / `catalog_trade` / `unit_price` resolved from the catalog and price book; we just stop re-doing that lookup on the estimate page.

### 3) Keep the per-photo "Add to estimate" path working

`addCodes` in `src/routes/_app.jobs.$id.estimate.tsx` still gets used by `AISuggestionsPanel` and `CompanionRulesBanner` with real catalog codes. Soften it so missing codes show a toast like `"2/5 codes not in catalog — skipped"` instead of a silent nothing — but otherwise leave the path alone.

## Files touched

- `src/components/jobs/PropertyAnalysisPanel.tsx` — replace `addAll` with a direct `estimate_line_items.insert` against the active estimate; ensure-or-create the active estimate on the fly; navigate to estimate after insert.
- `src/routes/api.analyze-property.ts` — strengthen the prompt against code-hallucination; drop `suggested_code` server-side when it isn't in the catalog.
- `src/routes/_app.jobs.$id.estimate.tsx` — improve the `addCodes` toast so partial misses are visible.

## Out of scope

- No DB migration.
- No changes to the per-photo `analyze-job-photos` flow or `AISuggestionsPanel`.
- No changes to roof measurement, mapbox, satellite, or PDF report code.

## After this ships

Click **Add 3 to estimate** in the Property Analysis panel → 3 line items appear immediately in the active estimate (with their AI-derived qty and unit price), the page navigates you to `/jobs/$id/estimate`, and the toast tells you exactly how many were added (and how many came in as custom because no catalog code matched).

