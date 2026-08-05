# Corrected roof footprints should stick — and teach the AI

Today, when you drag corners and hit "Save corrections", the correction is written to the training table (17 saved so far) and the current measurement is updated. But two things are missing:

1. Nothing reads those corrections back. "Clear all measurements" deletes the saved measurement, and the next "AI measurements" run starts from raw satellite output again — your fix is gone.
2. Corrections are only visible to the person who made them (row access is scoped to the creator), so a teammate re-measuring the same house never benefits.

## What changes

**1. Corrections become the memory for a property**

- New `roof_corrections` table: the corrected facet rings, total area, pitch, the AI original, the property/job, the pin location, and who corrected it. Company-scoped so anyone on the team benefits, not just the person who dragged the corners.
- Saving corrections writes here in addition to the training table.
- "Clear all measurements" only clears measurements. Corrections survive on purpose — that is the point of the feature. A separate "Also forget saved corrections for this address" option is available inside the clear confirmation for when you truly want a blank slate.

**2. AI measurements reuse the corrected footprint**

- When you drop a pin and run AI measurements, the server first looks for a correction within ~15 m of that pin (same property preferred).
- If it finds one, it returns the corrected facets directly, flagged as `source: corrected`, and the map shows a small "Using your saved correction" chip with a "Re-run raw AI instead" link.
- If none exists, it measures normally.
- Because the lookup runs server-side with elevated access, corrections made by any teammate on that company apply.

**3. Getting better over time (beyond the same house)**

Two concrete, honest improvements — no model retraining, just calibration from your own data:

- **Area calibration**: from all corrections in the company (and nearby geography), compute the median ratio of corrected area to AI area. New measurements outside the correction radius get that scale factor applied, with the factor shown in the AI settings panel ("Learned calibration: 0.94x from 17 corrections") and an override to disable it.
- **Footprint snapping strength**: corrections that consistently pull facets toward the building outline raise the default edge-tightness for that company, so new roofs start closer to where you keep moving the corners.

Both are visible and reversible in the existing per-job AI settings panel, so a bad calibration can never silently wreck a measurement.

## Technical notes

- New table `public.roof_corrections` (property_id, company_id, lat, lng, corrected_facets jsonb, ai_facets jsonb, corrected_plan_sqft, ai_plan_sqft, created_by, timestamps) with GRANTs and company-scoped RLS via `auth_company_id()`; super admins read all.
- Lookup + calibration live in `src/routes/api.solar-roof-extract.ts` (server route, service-role read), returning `source: "corrected"` and `calibration` metadata alongside the existing segment payload.
- `src/components/roof/SolarRoofTab.tsx`: `saveVertexCorrections` also upserts `roof_corrections`; `clearSaved` gains the optional forget-corrections checkbox; `measurePinAt` surfaces the corrected/calibrated badge.
- Calibration factor computed as a median over `roof_corrections` rows for the company, clamped to 0.8–1.25 so a single bad edit cannot skew results.
