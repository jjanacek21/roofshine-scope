# Claim Buddy Map Mode (Door to Door + Storm Intel)

A new full-screen map surface inside Claim Buddy, reached from the dashboard, that turns canvassing into a pre-filled inspection.

## Entry point

- New "Door to Door mode" tile/button on the Claim Buddy dashboard, next to Start Inspection.
- Opens `/cb/map` — full-screen satellite map, centered on the rep's current GPS location, with a dot over every detected house (same building-footprint pin logic already used by the Door to Door world map).
- Bottom toggle inside map mode: **Canvass** | **Storm intel**.

## Tapping a pin — side panel

One scrolling panel (bottom sheet on phone, right rail on tablet/desktop), in this order:

1. **Disposition grid** — the same quick disposition buttons as Door to Door (Not home, Not interested, Go back, Interested, Inspect, Storm, Lead, New roof, Follow up, Won, etc.). Tapping one saves immediately and recolors the dot.
2. **Resident details** — name, phone, email, plus the reverse-geocoded address of the pin (editable).
3. **Insurance + storm** — carrier, claim number, deductible, date of loss, and a read-only "recent storm activity at this house" block pulled from the storm database (largest hail size and peak wind gust with dates, for the selected time range).
4. **Create AI mailer** — reuses the existing storm mailer generator, pre-seeded with this address and its storm history.
5. **Start inspection** — creates a Claim Buddy job pre-filled with everything captured above, then drops the rep straight at the cover photo step.

## Start inspection behavior

Creating the job from a pin writes: customer name, phone, email, address/city/state/zip, lat/lng, carrier, claim number, deductible, date of loss, inspection date (today).

The rep skips the customer form and lands on **cover photo**, then the normal **roof / exterior / interior** choice. Everything downstream (measurement, takeoff, report, estimate, present) is unchanged. The pin is marked "Inspected" and links to the job, so re-tapping it opens the existing inspection instead of creating a duplicate.

## Storm intel inside map mode

Same data and filters as the Storm Intelligence page — time range, hail/wind toggles, band legend and counts — rendered as swath overlays on the same map, so pins and swaths are visible together.

- "Current location" button recenters on the rep's GPS position at street zoom with swaths on top.
- Pins can still be dropped and dispositioned while swaths are showing.

## Technical notes

- Route: `src/routes/cb.map.tsx`, wrapped in `CbSurface` so it inherits Claim Buddy styling; new components under `src/components/claim-buddy/map/`.
- Map layers reuse the building-pin derivation and disposition coloring from `src/components/door-to-door/DoorToDoorMap.tsx`, extracted into a shared component rather than copy-pasted.
- Pin data uses the existing `property_dispositions` table (shared with Door to Door, so canvassing done in either surface shows in both). Two columns get added: `carrier`/`claim_number`/`deductible` fields and a `cb_job_id` link, with grants and RLS matching the existing per-user policies.
- Storm overlays reuse `StormSwathMap`'s swath sources and the `stormSupabase` RPCs (`hail_swaths_in_view`, `wind_swaths_in_view`, `storm_report_at_point`); the per-house storm block calls `storm_report_at_point` for the pin.
- AI mailer reuses `src/lib/storm-mailer.functions.ts` and `StormMailerModal`.
- Job creation extends the existing `cb_jobs` insert in `CbDashboard`, moved into a shared helper that accepts prefill fields and navigates to `/cb/job/$id/cover`.
- No changes to the GlobalContractor Door to Door screens, the measurement wizard, report, or estimate.
