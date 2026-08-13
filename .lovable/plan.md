# Fix: pin won't drop and there's no "Measure roof" button

## What your screenshot shows

The map is plain satellite — no orange facet outline, no labels — even though the cards below it list House · Facet 1 with eaves and rakes. Pin drop mode is on ("Tap roof now"), but tapping does nothing.

On a fresh Chromium session against the same job, the facets draw and the tap places a pin, so this is not the geometry or the data — it is the map failing to finish initializing on your phone.

## Cause

The editor only starts drawing and only starts listening for taps after Mapbox fires its one-time `load` event. Everything is gated on that single event:

- the facet fill, edge, label and pin layers are created inside the `load` callback
- the tap handler is registered only once the `ready` flag flips

If that event is missed on your device — slow token fetch, the map created before the card has a height, or the style already being loaded by the time the listener attaches — the map still renders satellite tiles but has no layers and no tap handler. That is exactly the two symptoms together: nothing highlighted, and tapping the roof does nothing.

## Fix

1. **Make map setup event-independent.** Set the layers up through a function that runs on `load`, on `style.load`, and immediately if the style is already loaded, and make it safe to call more than once (skip a source/layer that already exists). Recheck once shortly after mount so a late style load still initializes.
2. **Register the tap handler on map creation**, not after `ready`. A tap in pin mode should place a pin even if the drawing layers never came up.
3. **Never lose a dropped pin visually.** If the pin layer isn't available, fall back to a plain Mapbox marker so the pin is always visible.
4. **Add a real "Measure this roof" button on the map card**, right under the toolbar, visible in every phase: disabled with the hint "Tap the roof first" when no pin exists, and reading "Measure 1 pinned roof" once a pin is down. Today the only way to trigger a measurement after the first one is a ghost button far down the page.
5. **Show a plain-text fallback when the map can't draw** — if the plan has facets but the map never became ready, show a short line ("Map didn't load — measurements below are still valid") with a Retry map button, so you know the numbers are fine.

## Technical detail

- `src/components/cb/CbRoofPlanEditor.tsx`: extract the `map.on("load")` body into an idempotent `initLayers()`; call it from `load`, `style.load`, and directly when `map.isStyleLoaded()`; move the click listener out of the `ready`-gated effect; add a marker fallback for `measurePins`; add the "Measure this roof" button (new `onMeasure` / `measuring` props) and the map-not-ready notice.
- `src/routes/cb.job.$id.measure.tsx`: pass `onMeasure={run}` and `measuring={phase === "running"}` into the editor.

No changes to measurement math, colors, logo, or the GlobalContractor screens.
