# Fix the instant measurement highlight and the polygon draw tool

Two things are broken on the job measurement screen (the Solar / AI measurements tab): the measured roof is not highlighted over the house, and the "Draw area on map" polygon tool does not accept clicks.

I have not yet confirmed a single root cause, so the first step is reproducing it against the real screen with logging. What follows is what I will check, in order, and the fixes each finding leads to.

## Step 1 — Reproduce and capture the truth

Log in as the QA account, open the measurement tab on a job, drop a pin, and run the measurement while capturing:

- the raw response from the measurement endpoint (does it come back with real outline points, or an empty/1-point shape while still reporting square footage?)
- whether the highlight layers exist on the map at that moment and what data was pushed into them
- what happens on a map click while the draw tool is active

That tells us whether the missing highlight is "no geometry came back" or "geometry came back and was never painted". The banner in the screenshot reports 3,009 sqft, so the measurement itself produced numbers — the shape is what is in question.

## Step 2 — Fix the missing highlight

Depending on what Step 1 shows:

- **Geometry came back but was not painted:** the highlight layers are rebuilt from scratch whenever the map style reloads, and the repaint is only triggered by a few map events. I will make the painter re-run on every path that can clear the map (style reload, resize, tab switch back) and re-assert the layers immediately before pushing data, so the highlight can never be left empty after a successful measurement.
- **No usable outline came back:** the outline lookup currently rejects a building unless the pin sits inside it or its centre is within ~14 m. On large houses and corner lots that legitimately rejects the right building and leaves nothing to draw. I will loosen that to accept the building whose outline the pin is closest to on the ground, still rejecting an obvious neighbour, and keep the "couldn't trace it" warning for the genuine misses instead of showing nothing.

Either way, a measurement that returns numbers but no drawable shape will say so on the map rather than looking like a silent failure.

## Step 3 — Fix the polygon draw tool

Three things block the draw tool today and I will address all three:

1. **Clicks swallowed by other map modes.** Vertex-edit mode returns early on every map click. If it is left on, nothing happens when you click — and there is no visible sign it is on. Drawing will take priority over vertex editing, and entering the draw tool will exit vertex editing.
2. **Draw points not visible.** The dots and dashed outline are pushed to a map layer that is discarded whenever the satellite style reloads and is never re-populated, so clicks can register while nothing appears. The draw layer will be re-asserted and repainted whenever points change or the style reloads.
3. **The draw control is hard to reach.** "Draw area on map" only exists inside the structure card below the map. I will add draw / done / cancel to the on-map control bar so the tool can be started and finished without scrolling away from the roof.

## Technical notes

- `src/components/roof/SolarRoofTab.tsx` — `ensureOverlayLayers` / `paintRef` invalidation, the `ai-draw` source repaint effect, map click precedence between `drawingPinIdRef` and `editingVerticesPinIdRef`, on-map draw controls.
- `src/lib/footprint.server.ts` — containment / `NEAR_M` acceptance rule for the OSM outline.
- `src/lib/solar-extract.server.ts` — surface `footprint_source: "solar_boxes"` to the client so the tab can warn that the shape is a fitted rectangle rather than a traced outline.
- No changes to the Claim Buddy screens, the estimate, or the takeoff.
