
# Storm Intelligence → Door-to-Door Canvassing + AI Mailers

Four phases. Phase 1 and 2 are the usable product; Phase 3 adds batch work; Phase 4 is schema/stub only.

## Ground rules honored throughout
- Storm data stays read-only through the existing storm client; that file is not touched and no migrations run against it.
- All new tables/functions go in the main app database.
- Every magic number lives in one new config file: `src/lib/storm-config.ts` (pitch 1.08, waste 1.12, house-circle zoom 17, hail 60 days, wind 730 days, radius 805 m, wind min 60 mph).
- No feature currently in the storm map is removed.

---

## Phase 1 — Canvassing map + side panel

**Bug fix:** "Last 24 hours" currently queries 2 days; corrected to 1, including the fallback.

**Basemap:** swap the OpenStreetMap raster for Mapbox `satellite-streets-v12`, plus an explicit `mapbox.mapbox-streets-v8` vector source so building footprints are queryable by name rather than relying on style internals. Same token hook and token-error toast.

**House circles:** only at zoom ≥ 17. On map idle/moveend, building polygons in view are queried, centroids computed, deduped by rounded coordinates, and drawn as a circle layer with hover state and pointer cursor. Circles for houses that already have a saved disposition are colored by that disposition.

**Side panel** (new `StormPropertyPanel.tsx`, slide-over, full-width sheet on mobile), in order:
1. Reverse-geocoded address, skeleton while loading, lat/lng fallback.
2. Disabled "Owner details — coming soon" card, shaped for later ATTOM data.
3. Storm history from one `storm_report_at_point` call: headline largest hail / peak wind, then hail rows (last 60 days, colored by the returned color) and wind rows (last 2 years, with MPH, source, distance), newest first. Empty result renders an explicit "no qualifying storm activity" message, and a range asking for more hail than exists says "no data for this period" rather than implying zero storms.
4. Roof measurement card (below).
5. Disposition buttons using the existing save function.
6. "Create AI Mailer", disabled with a tooltip until a measurement exists.

**Measurement card** (new `RoofMeasureCard.tsx`) — never automatic:
- Existing `roof_measurements` row for the property renders instantly, no API call.
- Otherwise a "Measure this roof" button runs the existing Google-Solar multi-structure pipeline (`runAutoMeasure`). That helper is currently job-keyed; it gets a small property-keyed entry point so the same code serves both — no second pipeline.
- If no `properties` row exists, one is created from the geocoded address first.
- Result persists, so a repeat click is free. Spinner with a "may take a moment" note, and a real error message plus retry on failure.
- Measured facets draw on the map from `roof_sections.polygon_geojson` as translucent fills with bright outlines.

**Pitch and waste:** computed from plan/footprint area only, compounding 1.08 then 1.12 (net 1.2096), never from the already pitch-adjusted actual columns. Plan area comes from summing `roof_sections.plan_area_sqft`. The panel shows the full breakdown: footprint → +8% pitch → +12% waste → squares.

---

## Phase 2 — AI mailer generator

**Migration** (main DB): `storm_mailer_campaigns` and `storm_mailers` exactly as specified, including the Phase-4 tracking columns added up front, indexes on `(company_id, campaign_id)` and `(company_id, lat, lng)`, grants, and RLS restricting rows to the user's company. The full storm report is frozen into the row at generation time and never re-queried.

**Modal** (`StormMailerModal.tsx`), stepped: roof type (prefilled), squares (auto-filled from the 1.2096 figure, editable, marked auto-calculated), storm type (preselected hail if hail exists else wind), imagery (upload to a company-scoped storage bucket, or AI-generate a damage infographic / hail-size comparison / storm timeline built from the real dates), topic textarea, tone select (Urgent, Neighborly, Professional, Empathetic, Bold & Direct, Educational, Premium), signature radio with defaults pulled from profile/company, then Generate.

**Generation:** a `generate-storm-mailer` endpoint returning `{ subject, body }`. The letter uses the real dates, sizes and square count; matches the chosen tone; and states only that a storm hit the area with a free inspection offered — it never asserts the roof is damaged. Draft appears in an editable preview pane before saving as `draft`.

---

## Phase 3 — Bulk tagging, campaigns, one PDF

- "Tag damaged houses" multi-select mode on the map with a running count and box-select.
- Bulk generate: one set of modal answers applied across every tagged house, each pulling its own storm report and measurement, with per-house progress; a single failure does not abort the batch.
- Campaign list view with letter counts and statuses, approve individually or in bulk.
- Export: server-side render of all approved letters into one PDF — one letter per page, window-envelope address block, inline images, signature, plus a cover-sheet manifest of every address. Streamed to storage and returned as a signed URL; rows marked `exported`.

---

## Phase 4 — Scaffolding only

- `owner_lookups` table and an `enrich-property-owner` stub returning "not configured"; the disabled owner card reads from this table once rows exist.
- Email tracking columns land with the Phase-2 migration; no sender is wired.

Note for later: mass email with open tracking is subject to CAN-SPAM, and Florida restricts post-disaster and insurance-claim solicitation — worth clearing before the first send.

---

## Technical notes

- New files: `src/lib/storm-config.ts`, `src/components/storm/StormPropertyPanel.tsx`, `StormHouseCircles` logic module, `RoofMeasureCard.tsx`, `StormMailerModal.tsx`, `StormMailerPreview.tsx`, plus campaign route and export endpoint in Phase 3. `StormSwathMap.tsx` shrinks rather than grows.
- Backend work uses server functions and server routes on this stack (no new Supabase edge functions).
- One caveat on measurement storage: `roof_measurements` stores only the pitch-adjusted total, so plan area is derived by summing section `plan_area_sqft`. If a measurement predates sections, the card shows the stored total with a note instead of a fabricated footprint.
- Loading, empty, and error states are visually distinct on every async surface; layouts are checked at phone width.
