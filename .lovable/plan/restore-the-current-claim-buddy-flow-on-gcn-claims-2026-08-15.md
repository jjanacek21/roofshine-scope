# Restore the current Claim Buddy flow on gcn.claims

The screenshots confirm that `gcn.claims` is serving an older roof editor: its toolbar says **Edit / Line / + Structure / Undo**, and it starts with a generic four-corner square. That interface no longer exists in the current source.

The current source already has the intended flow:

```text
Customer information → Cover photo → Inspection type hub
                                      ├─ Roof
                                      ├─ Exterior
                                      └─ Interior

Roof measurement → drop pin → Measure roof → detected roof-edge footprint
```

`cb.job.$id.cover.tsx` currently navigates to `/cb/job/$id/scope`, and that route presents the three inspection choices. `cb.job.$id.measure.tsx` currently requires a dropped pin and calls the instant measurement engine with that pin; it does not intentionally create a generic square. No service-worker registration is present in the project, so this is not an app-managed offline-cache path.

## Implementation

1. **Lock both surfaces to the same inspection routes**
   - Keep cover-photo completion and skip actions pointed at `/cb/job/:id/scope` on standalone and platform surfaces.
   - Remove any remaining conditional or legacy redirect that can send standalone users directly from the cover photo to roof measurement.
   - Keep the inspection hub as the only normal entry into Roof, Exterior, or Interior.

2. **Lock both surfaces to the same measurement component and engine**
   - Ensure the Claim Buddy roof route on `gcn.claims` uses the current `CbRoofPlanEditor` and `getInstantMeasurement` path.
   - A new measurement starts in pin-drop mode, then exposes **Measure roof** after a pin is placed.
   - Accept only the detected roof-edge footprint from the engine; never manufacture or silently display a generic square when detection fails.
   - If detection cannot produce a footprint, keep the satellite map open with a clear retry/reposition-pin state rather than advancing with fake dimensions.

3. **Fix tablet pin/line editing and Mapbox overlap**
   - Press and hold (~250 ms) a measurement pin, draft-line point, or saved-line endpoint to drag it precisely, using the existing 44px corner target, pointer capture, disabled map pan, magnifier loupe, and live length updates.
   - Commit each drag as one Undo action and snap nearby line endpoints to footprint corners/other endpoints.
   - Move the drawing undo bar above Mapbox attribution and place the Mapbox logo/attribution in a non-overlapping bottom corner so tapping Undo cannot open mapbox.com.

4. **Publish and verify the actual custom-domain build**
   - Publish the corrected build so `gcn.claims` receives the same current code as the platform surface.
   - On a tablet-size viewport, verify: cover photo → inspection hub; select Roof → pin-drop measurement; no generic square; pin and line-point long-press dragging works; Undo is fully tappable without triggering the Mapbox link.
   - Verify the Global Contractor entry reaches the same Claim Buddy behavior and that no Global Contractor screen changed.