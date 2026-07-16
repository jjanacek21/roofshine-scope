## Plan

1. **Stop the black-canvas failure path**
   - Replace the Mapbox-hosted style URL (`mapbox://styles/mapbox/dark-v11`) with a small inline style object using raster OpenStreetMap tiles.
   - Keep Mapbox GL for the map engine, controls, markers, popups, and storm layers, but remove the fragile Mapbox style/sprite/glyph/iconset dependency that is currently loading and then timing out before `load` completes.
   - Keep the public Mapbox token for address autocomplete and any Mapbox GL requirements.

2. **Make map readiness based on the actual safe event**
   - Use `style.load` / loaded-style checks and a backup timeout instead of only waiting on the full Mapbox `load` event.
   - Call the same idempotent `setupLayers(map)` once the style is usable, so hail, wind, territories, popups, and the selected address marker are restored every time.

3. **Fix the runtime error and layer setup fragility**
   - Remove any expression/path likely causing the minified `y is not defined` failure in this storm map path.
   - Keep all layer IDs, source IDs, click behavior, and data filtering the same: hail = last 60 days; wind = last 2 years and 60+ MPH.

4. **Keep the requested UX intact**
   - No South Florida / DFW toggles.
   - Address search remains in the toolbar.
   - Selecting an address flies to house-level zoom and drops a marker.
   - Clicking the house marker or any map point opens local hail/wind history.

5. **Verify in preview**
   - Load `/storm-intelligence` and confirm the map does not remain black or show “Map failed to load”.
   - Confirm address search, fly-to, marker placement, and click popup still work.
   - Check console for no `[StormMap] load watchdog timeout` and no `y is not defined` runtime error.