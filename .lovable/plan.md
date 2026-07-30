## What's wrong

I verified this against the live storm data for the pin in your screenshot (Homer Glen, ~41.600, -87.940):

- The swath query used to paint the map (`hail_swaths_in_view`, 60 days) returns a **3in+ hail swath dated Jul 27, 2026** covering that exact point.
- The point query used to fill the side panel (`storm_report_at_point`) returns `hail_dates: []` and `max_hail_in: null` for the same coordinates — it only finds the 70 mph wind report.

So the map and the panel are reading two different hail sources, and the point-level one is missing the swath coverage. That RPC lives in the external storm database (read-only from this app), so the fix belongs on the app side.

## The fix

In `src/components/storm/StormSwathMap.tsx`, stop trusting `storm_report_at_point` for hail and derive the panel's hail section from the same swath data the map draws:

1. When a point is selected, also call `hail_swaths_in_view` with a tiny bounding box (~±0.001°) around the clicked lat/lng, over the 60-day window.
2. Build the hail list from the returned features: one entry per `event_date`, with band (`3in+`, `1.5-2in`, …), its color, and size taken from `max_in` (falling back to `min_in`, rendered as `3"+` when there is no upper bound).
3. Merge into the report shown in the panel: use the swath-derived hail dates whenever they exist, keep `storm_report_at_point`'s hail rows as a fallback, and set `Max hail` in the header to the largest size found across both.
4. Leave the wind section exactly as it is today — that path is returning correct data.
5. Keep the existing loading/empty states; "No hail reported." should now only appear when neither source has anything.

## Technical notes

- Same `stormSupabase` client and RPC already used by the map layer, so no new permissions, keys, or backend changes.
- New react-query key includes the rounded lat/lng plus the 60-day window, cached like the existing point report.
- Storm-map "save as lead" / mailer payloads that read `max_hail_in` and `hail_dates` will pick up the corrected values automatically since they read from the merged report object.
