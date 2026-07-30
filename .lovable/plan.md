## What I verified

- Your last AI run on this job (6024 Jacquelyn Court, today 15:28 UTC) **succeeded**: 6 facets, 3,580 sq ft, carved from the real OSM footprint. So the server geometry is fine.
- The database has **zero saved measurements** for this property (`roof_measurements` / `roof_sections` are empty for it).
- I loaded the page in a browser: the AI Measurements tab shows the satellite map with **no pins, no highlight, 0 sqft**.

## Root cause

The AI Measurements tab **never saves its results**. Facets live only in React state. The moment you switch tabs, reload, or click "Clear all measurements", they're gone — and the hydration code that restores the highlight reads from `roof_sections`, which is empty, so nothing comes back. (The one path that does save is "Apply to Mapbox tab" → Save Measurements.)

A second, smaller issue: the hydration query uses `.maybeSingle()` on `roof_measurements` for the property. If a property ever has more than one measurement row, that call errors and hydration silently gives up.

## Fix

1. **Persist AI results** (`src/components/roof/SolarRoofTab.tsx`): after a pin is measured (single or "AI measurements" bulk run), upsert one `roof_measurements` row for the property with `source: 'google_solar'` and one `roof_sections` row per facet (name, pitch, plan area, polygon GeoJSON, sort order). Replace that measurement's sections on each re-run so re-measuring doesn't duplicate. "Clear all measurements" keeps working as-is.
2. **Harden hydration**: swap `.maybeSingle()` for `order('created_at', { ascending: false }).limit(1)`, and prefer the newest `google_solar` measurement. Keep the existing rule of not clobbering pins the user has already placed in the session.
3. **Make the overlay layers race-proof**: extract an idempotent `ensureOverlayLayers(map)` that adds the facet sources/layers if missing, and call it both on map `load` and at the top of `updateOverlays()`. Today the layers are only created in the `load` handler, so an early pin update can paint into sources that don't exist yet and never retry.
4. **Verify**: reload the job's Measurements → AI Measurements tab in a browser, drop a pin, run AI measurements, confirm the blue facet highlight + sqft labels appear, then reload the page and confirm the highlight comes back from the database.

## Not changing

Geometry/Voronoi carving, tuning settings, pitch handling, and the Mapbox Draw tab stay as they are.
