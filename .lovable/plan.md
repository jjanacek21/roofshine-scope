# Fix Solar API 404 "entity not found" errors

The Google Solar API returned 404 because it has no HIGH-quality building data at this property's exact coordinates. We'll make the endpoint more forgiving and give the user a clear path forward when coverage truly is missing.

## What changes

### 1. Quality fallback in `src/routes/api.solar-roof-extract.ts`
Try the Solar API in this order, returning the first success:
1. `requiredQuality=HIGH` at the given lat/lng
2. `requiredQuality=MEDIUM` at the given lat/lng
3. `requiredQuality=LOW` at the given lat/lng
4. If still 404, try `MEDIUM` at 4 small offsets (~10m N/S/E/W) — handles the case where the pin sits on a driveway or pool cage instead of the roof centroid

Return the `imagery_quality` we actually used so the UI can show it. Only return 404 to the client when *all* attempts fail.

### 2. Better error response
When all attempts fail, return a structured payload:
```json
{
  "error": "no_coverage",
  "message": "Google Solar has no building data for this address. Use Mapbox Draw to measure manually.",
  "address_lat": ..., "address_lng": ...
}
```
Status `404` so the client can branch on it cleanly.

### 3. Friendly empty-state in `src/components/roof/SolarRoofTab.tsx`
When the API returns `no_coverage`:
- Replace the raw JSON error toast with an inline card: *"This property isn't in Google's Solar coverage yet."*
- Add a primary button **"Switch to Mapbox Draw"** that flips the parent tab to manual drawing
- Add a secondary **"Try again"** button (in case of transient failures)
- Keep the existing toast only for non-404 errors (network, auth, 5xx)

### 4. Log coverage gaps for the training brain
When a 404 hits after all fallbacks, insert a row into `training_examples` with `solar_response: { error: "no_coverage" }` and the address. This builds a list of properties where AI is blind, which the Admin Training Center can surface as priority manual-measurement candidates.

## Files touched
- `src/routes/api.solar-roof-extract.ts` — quality fallback + nearby retry + structured 404
- `src/components/roof/SolarRoofTab.tsx` — empty-state UI + tab-switch handler
- `src/components/roof/RoofMeasurementPanel.tsx` — accept a `setActiveTab` prop so SolarRoofTab can switch to Mapbox

## Out of scope
- Switching to a different solar/imagery provider (e.g., EagleView API) — separate decision
- Auto-detecting the building footprint from satellite imagery via Gemini Vision — possible future fallback, but heavier lift
