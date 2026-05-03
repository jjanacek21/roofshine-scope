## Why most pins are missing

The Map view only drops a marker for leads that have `lat` / `lng`. A quick check against the database:

```
total leads:        1,258
with coordinates:      75
missing coordinates: 1,183
```

So ~94% of leads were never geocoded — they were imported from CSV/spreadsheets that didn't include lat/lng, and the lazy "geocode on detail open" path only fixes one address at a time.

## Fix

Two parts:

### 1. Add a "Geocode missing" action on the Map view

In `src/routes/_app.leads.map.tsx`, add a button in the right-hand sidebar header showing e.g. **"1,183 missing — Geocode now"**. When clicked it:

- Iterates leads where `lat == null || lng == null`.
- For each, calls Mapbox forward geocoding client-side (same pattern already used in the Wizard and Lead Detail Sheet) using `${address}, ${city}, ${state} ${zip}` and the existing `useMapboxToken()`.
- Concurrency-limits to 5 in flight, with a small delay, to stay well under Mapbox's 600 req/min limit.
- On each success, `supabase.from("leads").update({ lat, lng }).eq("id", lead.id)`.
- Live progress: `Geocoded 312 / 1,183 …` plus a small progress bar.
- On finish, `qc.invalidateQueries({ queryKey: ["leads"] })` so new pins appear immediately, and a sonner toast summarizing successes/failures.
- Failures (no Mapbox match) are logged to console but don't block the run.

### 2. Geocode automatically during CSV import

In the lead-import path (`src/server/leads.functions.ts` — the importer used by the Import screen), after rows are inserted in a batch, kick off a server-side geocode loop for any new rows that arrived without `lat`/`lng`:

- Use `fetch` against `https://api.mapbox.com/geocoding/v5/mapbox.places/{q}.json?access_token=${process.env.MAPBOX_API_TOKEN}` (token already in secrets).
- Process in chunks of ~50 with `Promise.all`, write back `lat`/`lng` via the admin client.
- Cap each import's geocode pass at the rows it just inserted (don't re-process the whole table on every import).

This way:
- Existing 1,183 stale rows get fixed once via the new "Geocode missing" button.
- All future imports arrive on the map automatically.

### Files

- `src/routes/_app.leads.map.tsx` — add the button, progress UI, and client-side batch geocoder.
- `src/server/leads.functions.ts` — add a server-side geocode pass at the end of the CSV import handler.

No schema changes; `leads.lat` / `leads.lng` already exist and are nullable.
