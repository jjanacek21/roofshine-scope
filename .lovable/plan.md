## What you're getting

Three things on top of the original AI-measurement fix:

1. **Visual proof on the map** — every facet the AI measured is highlighted as a colored polygon overlay on the satellite image, so you can immediately see if it missed a section under tree cover or merged the white flat roof into the tan pitched roof.
2. **A "Training Center" on the master admin dashboard** where you upload Roofr / EagleView / Hover PDFs paired with the address. The system extracts the ground-truth numbers and stores them as labeled examples.
3. **A "Measurement Reviews" queue** showing every AI measurement the team has run, with a one-click "Correct this" action that opens the Mapbox draw tool pre-loaded with the AI's polygons so you can drag, redraw, or split them. Every correction becomes another training example.

## Part 1 — The original AI measurement fix (unchanged)

Same as the prior approved plan:

- **Fix `measurePinAt` in `SolarRoofTab.tsx`** so a pin captures the **whole building** (sum of all facets at that location, area-weighted average pitch, merged outline) instead of just the closest single segment.
- **Promote "Measure entire property"** as the primary CTA — one click runs the full Solar API detection and creates one pin per facet.
- **Make the Solar → Mapbox hand-off explicit** with a green "Send to Mapbox to refine →" banner after detection.
- No DB migration; reuses the existing `roof_measurements.source = 'google_solar'` enum.

## Part 2 — Highlighted facet overlays (verify accuracy at a glance)

In `SolarRoofTab.tsx`, after the Solar API returns, add a persistent highlighted overlay layer on the satellite map that draws every detected facet:

- **Pitched roofs** = semi-transparent **amber/tan fill** with solid orange outline.
- **Flat roofs** = semi-transparent **cyan fill** with solid cyan outline (different enough from pitched that a tan house with a white flat porch shows up as two clearly separate colored regions).
- **Ignored / unmeasured** structures = **gray dashed outline** with no fill.
- Each polygon gets a small floating label: `"Main roof · 2,418 sqft · 6/12"`.
- A floating legend in the bottom-left of the map: **🟧 Pitched · 🟦 Flat · ⬜ Ignored**.
- A "Show coverage gaps" toggle that overlays a faint **red hatched fill** on the building footprint *not* covered by any facet — this is the single fastest way to spot a section the AI missed because of tree shadow or low contrast.

Implementation: add three new GeoJSON sources on the existing Mapbox map (`facet-pitched`, `facet-flat`, `facet-coverage-gaps`) populated from the same `pins[]` state that's already there. No new API calls — Solar already returns the polygon rings.

This same overlay also renders on the **Mapbox Draw tab** when sections originated from Solar, so the user can drag vertices on the highlighted shape directly.

## Part 3 — Training Center (admin dashboard, PDF ingestion)

A new admin-only page at `/admin/training` (visible to `super_admin` roles only):

**Upload flow:**
1. Drop a Roofr / EagleView / Hover PDF + the property address it's for.
2. Server extracts the ground-truth numbers (total sqft, predominant pitch, eaves LF, rakes LF, ridges LF, hips LF, valleys LF, per-facet table if present).
3. The system geocodes the address, runs the same Google Solar call our app uses, and stores both side-by-side as a labeled `training_example` row.

**Why this helps even though we can't fine-tune Google's model:**
- Builds a dataset of `{ Solar API output → ground-truth from PDF }` pairs.
- Lets us compute and *display* a per-property correction factor (e.g. "Solar consistently underestimates by 4% on this zip code").
- The dataset is the input we feed to the LLM-based corrector in Part 5 — every new PDF makes that corrector's prompt smarter via a few-shot retrieval against the closest comparable properties.
- Zero ongoing cost — PDFs sit in `roof-reports` (existing bucket); extracted JSON sits in `training_examples`.

**New table** (one migration):
```
training_examples
  id, address, lat, lng,
  ground_truth jsonb,        -- {total_sqft, pitch, eaves_lf, ...}
  solar_response jsonb,      -- raw Solar API response we recorded
  source text,               -- 'roofr' | 'eagleview' | 'hover' | 'manual'
  pdf_storage_path text,
  notes text,
  created_by uuid, created_at
```

**Server route** `src/routes/api.train-from-pdf.ts`: takes uploaded PDF, sends to Lovable AI Gateway (Gemini 2.5 Pro for vision + table extraction) with a strict JSON-output schema, normalizes the result, calls Solar at the same address, inserts both rows.

## Part 4 — Measurement Reviews queue (correct mistakes + collect labels)

A new admin page at `/admin/measurement-reviews` listing every `roof_measurements` row across all companies (you only — `super_admin`), with:

- Address, source (Solar AI / Mapbox / Manual), total sqft, age, who created it.
- A green "Verified" pill if a correction has been saved, an amber "Needs review" pill otherwise.
- One-click **"Correct this"** opens the existing `MapboxRoofDraw` panel **pre-loaded with the AI's saved facets** — you drag vertices, split a polygon in half, add a missed structure, or delete a hallucinated one.
- On save, the corrected polygons are written back to `roof_sections` AND a `training_example` row is auto-created with `source = 'manual_correction'` so it joins the dataset from Part 3.

**No new tables** — this reuses `roof_measurements`, `roof_sections`, and `training_examples` from Part 3. The only addition is a `verified_at timestamptz` column on `roof_measurements` to drive the pill.

## Part 5 — How the "AI brain" actually uses this data

We can't fine-tune Google Solar, but we can make our system smarter every time a PDF or correction lands. After Solar returns, the server runs one extra step:

1. Look up the **5 nearest training examples** by lat/lng (simple bounding-box query on `training_examples`).
2. Send them as few-shot examples to Lovable AI (Gemini 2.5 Pro) along with Solar's raw response, asking: *"Given these calibrated examples, propose a corrected total sqft and per-facet pitch."*
3. Return both the **raw Solar number** and the **AI-calibrated number** side by side in the totals card. The user picks which to trust (and that pick is itself a training signal).

This means: every PDF you upload tonight measurably improves tomorrow's measurements in the same neighborhood.

## Files to touch

**New:**
- `src/routes/admin.training.tsx` — replace the existing `ComingSoon` placeholder with the upload UI + dataset table.
- `src/routes/admin.measurement-reviews.tsx` — new admin page with the queue + "Correct this" launcher.
- `src/routes/api.train-from-pdf.ts` — server route for PDF → ground-truth extraction via Lovable AI.
- `src/routes/api.calibrate-solar.ts` — server route that runs Solar + few-shot correction and returns both numbers.

**Modified:**
- `src/components/roof/SolarRoofTab.tsx` — fix `measurePinAt`, add highlighted overlays, add coverage-gap toggle, add legend, call the new calibration endpoint.
- `src/components/roof/MapboxRoofDraw.tsx` — accept and render the same highlighted overlay for sections originating from Solar; add a "load AI shapes" mode used by the review queue.
- `src/components/roof/RoofMeasurementPanel.tsx` — default tab to `solar` when coords exist; show calibrated vs raw totals; add `onSaveSuccess` hook that flips `verified_at` when a super_admin saves from the review flow.
- `src/components/layout/AppSidebar.tsx` — add **Training** and **Measurement Reviews** items under the Admin section (super_admin only — already gated).

**Database (one migration):**
- New table `training_examples` (schema above) with RLS: only `super_admin` can read/write.
- New column `roof_measurements.verified_at timestamptz null`.
- New storage bucket policy on existing `roof-reports` allowing super_admin to upload training PDFs.

## Out of scope

- No actual model fine-tuning (Google Solar isn't trainable; the "training" is a growing few-shot dataset that calibrates outputs at request time).
- No automated PDF parsing for non-roof documents.
- No changes to the photo upload flow, estimate flow, or report PDF generator.

## After this ships

- Drop a pin → see the **whole house highlighted in tan** with the flat porch in cyan, total sqft and pitch labeled on each polygon. If the AI missed your detached garage, you'll see a red hatched gap exactly where the garage is.
- Upload 10 Roofr PDFs in the admin Training Center → the next measurement in any of those zip codes shows both **"Solar: 28.4 SQ"** and **"Calibrated: 30.1 SQ (based on 10 nearby examples)"**.
- Find a botched measurement in the Reviews queue → click **Correct this** → drag two vertices → save. The fix is live for the customer and your training dataset just grew by one labeled example automatically.
