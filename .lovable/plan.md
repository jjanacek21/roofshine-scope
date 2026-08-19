# Why the roof comes back as a square (and why it's slow)

## What's happening

The instant measurement runs three things back to back for every pin:

1. Google Solar — up to 7 tries (3 image-quality levels, then 4 nudged points ~10 m away).
2. Building outline lookup — the cached OSM service, then two Overpass mirrors at 12 s each.
3. An AI vision trace of the satellite image — a high-detail image sent to a reasoning model, capped at 20 s.

Two consequences:

- **The square.** When the outline lookup finds nothing *and* the vision trace doesn't answer in 20 s, the code falls back to a rectangle fitted around Google's roof boxes (`footprintFromSegmentBoxes` returns a minimum-area rectangle — exactly the 4-corner shape in your screenshot). It gets saved with no indication it wasn't traced.
- **The wait.** Those three stages run one after another, so a slow stage adds to every other stage. Worst case is the full 45 s ceiling, and the slowest stage (the vision trace, run at medium reasoning effort on a full-detail 1024px image) is usually the one that runs out of time — which is also what produces the square.

So the slowness and the square are the same problem: the accurate path times out and the crude path wins.

## The fix

**1. Run the stages in parallel instead of in sequence**
The vision trace and the outline lookup only need the pin — neither depends on Google Solar. Kick off all three the moment the pin is dropped and await them together. Total time becomes the slowest stage, not the sum.

**2. Make the vision trace fast enough to actually finish**
Drop reasoning effort to minimal and stop streaming the reasoning summary, which is the bulk of the current latency. Give it a 25 s budget inside a parallel race rather than 20 s stacked on top of everything else.

**3. Trim wasted Google Solar work**
Stop walking the 4 offset points once a usable result or a real building outline is in hand. Those extra round trips currently run even when we already know the roof.

**4. Never hand back a silent rectangle**
If the only geometry available is the box-fitted rectangle, label the result as an untraced estimate: keep the shape (it's still a starting point) but show a clear banner on the map — "Auto outline couldn't be traced — drag the corners onto the roof" — and mark the saved measurement's source as `segment_boxes` so reports and the takeoff know it was rep-adjusted, not measured.

**5. Cache the trace per pin**
Re-measuring the same house currently redoes the whole pipeline. Store the traced outline against the pin coordinates so a retry, a back-navigation, or a second pin on the same structure returns instantly.

## Technical notes

- `src/lib/cb-measure.server.ts` — restructure the per-pin loop: `Promise.all` over `runSolarRoofExtract`, `fetchBuildingFootprint`, `traceRoofFromPin`; feed the Solar candidate ring to the tracer only when it lands first, otherwise trace from the pin alone. Return `footprint_source` in a form the editor can read.
- `src/lib/roof-vision-trace.server.ts` — `reasoning: { effort: "minimal" }`, drop `summary: "auto"`.
- `src/lib/solar-extract.server.ts` — short-circuit the offset attempt list; skip the box-rectangle path when a real footprint is present (already partly true) and tag the response when it isn't.
- `src/components/cb/CbRoofPlanEditor.tsx` — surface the untraced-outline banner from `footprint_source`.

No changes to the takeoff sheet, estimate, report, or any GlobalContractor screen.
