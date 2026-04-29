
## Goal

Turn the **AI Training Center** into a true feedback loop: every AI-instant measurement that runs in the app gets logged with its highlighted roof footprint, pitch breakdown, and waste-adjusted squares. From the same admin area, super-admins can correct the footprint (polygon tool) or upload a Roofr/EagleView PDF to compare against the AI's proposal. Plus a new **Admin Jobs** tab to manage and bulk-delete test jobs.

## Current state (verified)

- Every AI run already saves a `roof_measurements` row with `source = 'solar'` plus `roof_sections` (polygon GeoJSON, pitch, plan area) and `roof_edges`. So footprint + math is already captured — we just don't surface it for review.
- `admin/measurement-reviews` exists but only shows a flat list with Verify/Re-open. No map preview, no pitch/waste breakdown, no PDF compare, no link from Training Center.
- `admin/training` accepts ground-truth PDFs but is disconnected from the live AI runs.
- No admin-wide Jobs page exists — super-admins have no way to see/delete jobs across companies.

## Plan

### 1. AI Measurements queue inside the Training Center

Restructure `src/routes/admin.training.tsx` into two tabs:

- **AI Measurements** (new, default tab) — reverse-chron list of every `roof_measurements` row where `source = 'solar'` (the AI/Google-Solar instant measurements). Each card shows:
  - Property address + company name + run date
  - Total plan sqft, **after-pitch actual sqft** (sum of `roof_sections.actual_area_sqft`), squares
  - **Waste breakdown table**: 0%, 10%, 15%, 20% — sqft and squares for each
  - Predominant pitch, # of sections
  - Status pill: `Needs review` / `Corrected` / `Verified` / `Has ground-truth PDF`
  - Mini Mapbox satellite thumbnail with the AI-detected facets overlaid (reusing `SolarRoofTab` color scheme — amber pitched / cyan flat)

- **Ground-truth PDFs** (existing upload form + dataset list, moved into this tab)

Clicking a measurement card opens a **review drawer/dialog**:
- Full-size Mapbox map with the AI footprint overlaid on satellite imagery
- Two action buttons:
  - **Draw correct footprint** → opens the existing measurement panel polygon tool pre-loaded with the AI footprint as a starting point. Saving creates/updates a `roof_measurements` row with `source = 'manual'` + sets `verified_at`, and writes a `training_examples` row pairing the AI response (already in `ai_analysis`) with the corrected ground truth.
  - **Upload Roofr / EagleView PDF** → reuses existing `/api/train-from-pdf` flow but auto-fills the address + links the resulting `training_examples` row to this measurement via the existing `source_measurement_id` column. Once uploaded, the card shows a side-by-side delta (AI vs PDF) like the existing dataset list does.

### 2. Persist the AI overlay so we can re-render it

The `roof_measurements.ai_analysis` JSONB already stores the Solar API response. Confirm `SolarRoofTab` writes the segment polygons there on save; if not, extend the save path so the review drawer can re-render the highlighted facets without re-calling Google Solar.

### 3. Admin Jobs management page

New route `src/routes/admin.jobs.tsx`:
- Table of all jobs across all companies (super-admin RLS already allows this via `is_super_admin()` — but `jobs` table currently has no super-admin policy. Add a migration: `CREATE POLICY "Super admins manage jobs" ON public.jobs FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());` Same for `properties`, `clients` if needed for cascade visibility.)
- Columns: Job name, company, client, address, status, created date, total estimate, AI measurements count
- Filters: company dropdown, status, search by name/address, "Test jobs" quick filter (name contains "test")
- Per-row actions: Open job, **Delete**
- Bulk select + **Delete selected** for clearing test data
- Add `/admin/jobs` to the `NAV` array in `src/routes/admin.tsx` (Briefcase icon), placed under the existing Companies entry.

### 4. Wire measurement → company/property data

The reviews list needs company name + address. Use a single Supabase select with joins:
```ts
supabase.from("roof_measurements")
  .select("*, property:properties(address, lat, lng), company:companies(name)")
  .eq("source", "solar")
  .order("created_at", { ascending: false })
```

## Technical notes

- Files created: `src/routes/admin.jobs.tsx`, `src/components/admin/AIMeasurementReviewDrawer.tsx`, `src/components/admin/MeasurementMapPreview.tsx`
- Files edited: `src/routes/admin.training.tsx` (tab structure), `src/routes/admin.tsx` (NAV), `src/components/roof/SolarRoofTab.tsx` (ensure full Solar response saved to `ai_analysis`), `src/routes/api.train-from-pdf.ts` (accept optional `source_measurement_id` form field)
- Migration: add super-admin RLS policy on `jobs` table (and `properties` if cascade reads needed)
- Reuse existing `useMapboxToken` hook + Mapbox GL — no new dependencies
- The existing `admin/measurement-reviews` page becomes redundant; either delete it or leave it as a "verify-only" shortcut. Recommend deleting and updating the NAV.

## Out of scope

- Auto-retraining the AI from corrections (data is captured; using it to fine-tune prompts is a follow-up)
- Per-company training datasets (shared global dataset for now)
