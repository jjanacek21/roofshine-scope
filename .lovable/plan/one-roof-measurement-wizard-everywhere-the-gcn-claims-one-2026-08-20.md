# One roof measurement wizard everywhere — the gcn.claims one

The phone experience you like is the Claim Buddy editor (`CbRoofPlanEditor`): green pin drop, AI edge-traced single outline, corner dots you can drag, add-a-point between corners, Save footprint, then draw lines and label them. That becomes the only roof measurement wizard in the product.

## What's there today

The GlobalContractor measurement screen still shows a tab strip: Manual Entry, Mapbox Draw, Roof Measurement, AI Condition, Upload Report. "Mapbox Draw" is a completely separate drawing engine (`MapboxRoofDraw`, its own toolbar and edge-label editor) — that's the screen in your first screenshot with the blue polygon and its own tag/undo/trash toolbar. "Manual Entry" is a third, numbers-only path. Only the "Roof Measurement" tab uses the Claim Buddy editor.

That's why every door looks different.

## What I'll do

1. **Delete the competing wizards.**
   - Remove the Manual Entry and Mapbox Draw tabs from the GlobalContractor measurement panel, and delete `MapboxRoofDraw.tsx`, `DrawToolbar.tsx`, `EdgeLabelEditor.tsx`, `ManualMeasurementForm.tsx`, `MeasureTuningPanel.tsx`, and `RoofSectionCard.tsx` along with any now-dead helpers.
   - Keep AI Condition and Upload Report — those aren't measurement wizards.
   - The panel becomes: the Claim Buddy editor first, with Condition and Upload Report beside it.

2. **Same wizard, same behaviour, everywhere.** GlobalContractor (`/jobs/:id/measure`), the client-detail measure sheet, and Claim Buddy (`/cb/job/:id/measure`) all mount the identical editor with identical toolbar, gestures and steps. Only persistence differs (property-scoped vs job-scoped), which is already the case.

3. **Lock the visual language to the phone version.** Orange traced outline with a translucent orange fill, one outline per structure (no facet split — that's already the engine rule), white/orange corner dots at every vertex, smaller hollow dots at edge midpoints that become a real corner when dragged, and the "Drag the corners onto the roof, then Save roof footprint" prompt.

4. **The step order becomes explicit on every surface:** drop pin → Measure roof → refine corners / add points → **Save this footprint** → draw lines (hip, ridge, valley…) snapping to the saved corners → tap any line to label it. No screen skips a step or offers a different order.

5. **Fix the desktop highlight.** On a computer the corner dots appear but the roof isn't filled. I'll reproduce it at desktop width first and fix the actual cause in the editor's map layer setup rather than guessing — the fill layer and the handle layer come from the same code path, so one of them is losing its source or getting buried on style reload at that size.

6. **Publish and verify** on phone width, iPad width, and desktop, on both `gcn.claims` and the GlobalContractor app, with screenshots: pin drops, trace returns a real edge-following orange outline, corners drag, a mid-edge point can be added and dragged, footprint saves, lines attach to saved corners, and labels apply per line.

## Notes

Existing saved measurements aren't touched — removing the Mapbox Draw UI doesn't delete stored roof data. If any job's measurement was originally captured with the Mapbox Draw tool, it will open in the unified editor from here on.

Nothing outside the roof measurement screens changes: no takeoff, estimate, report, or branding edits.
