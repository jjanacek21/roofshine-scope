

## Goal

Change the photo workflow from "analyze each photo in isolation → suggest items per photo" to **"upload all property photos → one AI pass over the entire set → produce a consolidated, deduplicated estimate with product details, condition, and quantities for the whole property."** Stop relying on the satellite-image roof measurement (it's inaccurate) and let the AI derive roof and surface quantities from the actual photos the user took on site.

## What changes for the user

On the Photos tab, after uploading photos, a new primary button:

**▶ Analyze Property (all photos)**

Click it once. The AI looks at every photo in the job together, then returns a single consolidated panel:

```text
PROPERTY ANALYSIS · 14 photos analyzed
─────────────────────────────────────────
Roof          asphalt 3-tab  · 18-22 yrs · condition 38/100
Siding        vinyl D4        · 12-15 yrs · condition 71/100
Interior      drywall ceiling · water damage in 2 rooms
─────────────────────────────────────────
SUGGESTED LINE ITEMS  (matched to your price book)
  ▸ RFG-220  R&R Laminated comp shingles      22.0 SQ   $XXX/SQ   high
        Source: 6 roof photos · hail bruising, 3-tab
  ▸ RFG-RDG  Ridge cap shingles                 78 LF   $XXX/LF   high
        Source: 2 ridge close-ups
  ▸ DRY-12   R&R 1/2" drywall – ceiling       240 SF   $XXX/SF   medium
        Source: 3 interior photos · ceiling stains, sagging
  …
[ Review & add all to estimate ]   [ Edit individually ]
```

Each suggested line item shows: matched price-book code + name, aggregated quantity (not per-photo), unit price from the active price book, confidence, and the **photos it came from** (click to see thumbnails). Per-photo "Add to estimate" still works for power users, but the default flow is the consolidated rollup.

## How it works

### 1) New endpoint: `POST /api/analyze-property`

Takes `{ job_id }`. On the server:

- Load all `job_photos` for the job + signed URLs for each.
- Load the catalog the same way `analyze-job-photos` does (company-scoped + master fallback, optionally filtered by `job.primary_trade`), and resolve unit prices from `job.price_book_id` so the AI's suggestions can be priced immediately.
- Single multimodal call to `google/gemini-2.5-pro` via the AI gateway with **all photos in one user message** (text prompt + N `image_url` parts). Gemini handles multi-image input natively.
- Tool-call schema returns one structured result for the whole property:
  ```ts
  {
    property_summary: { roof, siding, interior, exterior, ... condition_score, age_estimate },
    surfaces: [{ name, material, area_estimate_sf|squares|lf, condition_score, defects, source_photo_indices }],
    consolidated_line_items: [{
      suggested_code, description, qty, unit, confidence,
      product_details: { material, brand_guess, color },
      condition_notes,
      source_photo_indices: number[]
    }],
  }
  ```
- The prompt instructs Gemini explicitly: "Treat the photos as ONE property. Deduplicate — if 5 photos show the same roof slope, that's still one roof. Aggregate quantities across photos. Estimate squares (1 SQ = 100 SF), LF, and counts directly from what you see in these photos. Match every line to a code from the catalog when possible."
- Persist to a new `job_property_analyses` row (one per job, latest wins) and write the resolved photo IDs into each `consolidated_line_items[].source_photo_ids` so we can show "from these 6 photos."

### 2) Client: new `PropertyAnalysisPanel` on the Photos tab

- Renders the property summary (roof / siding / interior cards).
- Lists `consolidated_line_items`, each with: code, description, qty + unit, unit price (resolved against the job's price book), confidence chip, product detail line, condition notes, and a row of source-photo thumbnails.
- **Review & add all to estimate** button → navigates to `/jobs/$id/estimate?codes=...&qtys=...` (extends existing estimate query-string flow already used by per-photo "Add to estimate") and inserts all approved items in one shot, marked `source = 'ai_property'`.
- Per-row checkbox so the user can uncheck things before adding.

### 3) Per-photo flow stays, demoted

- Keep `analyze-job-photos` and the per-card "Analyze" / "Add to estimate" buttons for spot use.
- Remove the auto-analyze-on-upload trigger (it currently fires one Gemini call per photo on upload). Replace with a single banner: "14 photos uploaded — Analyze property" that calls the new endpoint once. This is *cheaper* and produces *better* results.

### 4) Deprecate the satellite roof-measurement as the source of truth

- Keep `ConditionAITab` (satellite Claude pass) but label it "Pre-visit screening — verify on site." Stop pulling its `area_squares` into the totals panel.
- The new property analysis becomes the canonical source of measured quantities used in the estimate.

## Files

**New**
- `src/routes/api.analyze-property.ts` — multi-image Gemini call, returns consolidated analysis.
- `src/components/jobs/PropertyAnalysisPanel.tsx` — summary cards + consolidated line-item table with source-photo thumbnails and "Add all to estimate."

**Edited**
- `src/components/jobs/JobPhotosPanel.tsx` — add the "Analyze Property" button and mount `PropertyAnalysisPanel` above the per-photo grid.
- `src/components/jobs/PhotoUploader.tsx` — drop the per-photo auto-analyze on upload; instead invalidate the property-analysis query so the user sees the prompt to run a single analysis.
- `src/routes/_app.jobs.$id.estimate.tsx` — extend the existing `?codes=` query handler to also read `?qtys=` so consolidated items insert with their AI-estimated quantity (not 1).

**DB migration** (one new table)
```sql
create table public.job_property_analyses (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  company_id uuid not null,
  analysis jsonb not null,        -- the full structured result
  photo_count int not null,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index on public.job_property_analyses (job_id, created_at desc);
alter table public.job_property_analyses enable row level security;
-- standard company-scoped RLS via auth_company_id()
```

Plus add `source = 'ai_property'` as a recognized value in the existing `estimate_line_items.source` check (if it's a check constraint) or just write the new value if `source` is a free text column — will verify on implementation.

## Out of scope

- No changes to the per-photo Add-to-estimate path (kept as fallback).
- No changes to the Mapbox roof-section drawing flow (stays as the manual measurement source).
- No new dependencies. Same `google/gemini-2.5-pro` model already in use.
- No streaming UI — single ~15-30 s call with a spinner; matches the existing per-photo UX.

## Result

Upload all the property photos → one click "Analyze Property" → ~20 s later you see one consolidated panel: roof = X squares of 3-tab in poor condition, siding = Y SF of vinyl in fair condition, interior = Z SF of damaged drywall — each row already matched to a price-book code, priced from the active price book, with the source photos shown as thumbnails. Click **Add all to estimate**, the estimate populates in one shot with AI-derived quantities. The inaccurate satellite measurement no longer drives the numbers.

