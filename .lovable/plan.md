# Fix: roof highlight and corner handles only appear half the time

## What is happening

In your screenshot the satellite image is drawn, but there is no orange highlight and no corner handles, and the caption says "Map is still loading". That caption is driven by one internal flag (`ready`) in the roof plan editor.

That flag only flips true inside a setup routine that first checks `map.isStyleLoaded()`. On a phone that check can stay false for a long time — a stalled sprite or font-glyph request over cellular is enough — so the routine returns early every time, the highlight layers are never created, and the corner handles (which are also gated on the same flag) are never rendered. The retry loop gives up after 15 seconds, so once that window passes the screen stays stuck until you reload. On a fast connection the style resolves quickly and everything works, which is why it is intermittent.

## The fix

All in `src/components/cb/CbRoofPlanEditor.tsx`.

1. Stop trusting `isStyleLoaded` as a gate. Attempt the source/layer creation inside a try/catch and treat a successful `addLayer` as the signal that the map is usable. If it throws because the style is genuinely not parsed yet, swallow it and let the next attempt handle it.
2. Keep retrying instead of giving up. Replace the 15-second cutoff with a retry that continues until layers exist (backing off to ~1.5s after the first few seconds), and also re-run on `styledata`, `sourcedata` and `render` so a late style parse is always picked up.
3. Re-create layers after a style reload. Track the painted feature collection in a ref and re-apply it whenever the layers are (re)created, so a style swap can never leave the highlight blank.
4. Ungate the corner handles. Handles are plain DOM positioned with `map.project()` — they do not need any GL layer. Gate them on the map instance existing rather than on the `ready` flag, so corners are draggable even while the tiles are still settling.
5. Fail visibly, not silently. If the layers still have not come up after ~8 seconds, show a small "Retry map" action in the map card instead of the passive "Map is still loading" caption, so you have a one-tap recovery on a roof.

## Notes

No change to the logo, colors, measurement math, regularization, or any GlobalContractor screen. Verification: load the measure screen with network throttled so the style resolves slowly, and confirm the highlight paints and a corner can be dragged before the tiles finish.
