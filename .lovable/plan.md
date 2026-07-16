## Plan

1. **Replace quick-jump controls with address search**
   - Remove the USA / DFW / South Florida toggle buttons from the Storm Intelligence toolbar.
   - Add the existing address autocomplete search to the toolbar.
   - When an address is selected, fly the map directly to that location at house-level zoom and drop a marker.
   - Keep manual map movement working normally after search.

2. **Use fixed data windows requested**
   - Wind: always load the last 2 years of wind data and filter to numeric gust reports over 60 MPH.
   - Hail: load hail swaths for dates in the last 60 days.
   - Remove the user-facing wind duration dropdown and single event-date dropdown from this view.

3. **Click a house / point for local storm history**
   - When the user clicks the searched house marker or any map point, evaluate that lat/lng against the loaded storm layers.
   - Show a popup with:
     - Hail dates and hail-size bands from the last 60 days that intersect the clicked point.
     - Wind gust reports over 60 MPH from the last 2 years near the clicked point, showing `wind_mph + " mph gust"`.
   - If no matching records are found, show a concise “No matching hail or 60+ MPH wind found here” message in the popup.

4. **Make map loading self-healing without changing visual styling**
   - Keep one guarded Mapbox instance: only create when `mapRef.current` is null.
   - Cleanup always removes the map and clears `mapRef.current` for reliable StrictMode remounts.
   - Keep the 8-second load watchdog; if load does not fire, remove and retry once, then show a reload overlay.
   - Keep all sources/layers/popups/data restoration in one idempotent setup function.
   - Keep `ResizeObserver` calling `map.resize()`.
   - Log Mapbox `error` events to `console.error`.
   - Also fix the current `y is not defined` runtime error if it is coming from this storm map path.

5. **Verify behavior**
   - On the preview storm page, confirm the map does not remain a black canvas.
   - Search an address and confirm the map flies to the house marker.
   - Click the marker/map point and confirm hail + 60+ MPH wind popup results render from the loaded data.

## Technical notes

- This will mainly touch `src/routes/_app.storm-intelligence.tsx` and `src/components/storm/StormSwathMap.tsx`.
- I will reuse the existing Mapbox-backed `AddressAutocomplete` component rather than adding a new geocoder.
- For point-in-polygon / distance calculations, I’ll use small local helper functions unless a suitable dependency already exists, to avoid unnecessary package changes.
- I will not change the existing storm RPC names or visual layer styling unless required to support the new 60-day / 2-year behavior.