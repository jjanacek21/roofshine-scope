## What's broken today (verified)

- **Storm history fails.** The app calls `storm_report_at_point(p_lat, p_lng, p_hail_days, p_wind_days, p_wind_radius_mi)`. I tested the storm database directly: the function only accepts `p_lat, p_lng` (windows are fixed server-side at 60 days hail / 730 days wind) — hence "Could not find the function ... in the schema cache". Called with two arguments it returns hail dates, sizes, wind dates and speeds correctly.
- **No yellow house circles.** Storm Intel renders raw Mapbox building polygons as a translucent fill. Door-to-door World derives one circle marker per building footprint. Storm Intel never got that treatment.
- **No address.** The panel shows raw lat/lng; nothing reverse-geocodes the clicked point.
- **Measuring grabs the whole block.** `runAutoMeasureForProperty` probes the clicked point plus a ring of 12 offset points up to 50 m out and merges every building it finds (the 55-facet / 210-square result in your screenshot). Correct for "measure this property and its shed", wrong for "measure the house I clicked".

## Plan

### 1. Map: house circles + correct click target
- Add a derived building-pin layer to the storm map, mirroring door-to-door World: at zoom 17+, query rendered building footprints, compute each centroid, and draw a yellow ring per house.
- Clicking a ring selects that house (its centroid + footprint polygon), not an arbitrary map point. Storm-swath clicks still work when you're not on a house.
- Keep a faint footprint highlight only on the selected house.

### 2. Property side panel (replaces the small popup)
A right-hand panel styled like the door-to-door property panel, with sections:
- **Address** — reverse-geocoded from Mapbox on click (street, city, state, ZIP), shown as the panel title.
- **Storm history** — fixed by calling the RPC with `p_lat`/`p_lng` only. Lists every hail event (date, size, band) in the last 60 days and every wind event ≥60 mph in the last 2 years, newest first, with peak hail size and peak gust as headline stats. No external news sources (per your answer).
- **Instant measurement** — single-house mode (below), showing footprint → +8% pitch → +12% waste → squares, with facets drawn on the map.
- **Roof type** — selector saved onto the property record.
- **Create mailer** button.

### 3. Single-house measurement
- Add a `single: true` mode to the measurement pipeline: one Google Solar probe at the selected centroid, no offset ring, no cross-building merge. If a footprint polygon is available, discard any facet whose centroid falls outside it.
- The existing multi-structure scan stays available for job properties.

### 4. Mailer studio (rebuild of the current modal)
A stepped builder saved to `storm_mailers`:
1. **Content sources** — upload images, screenshots, PDFs or documents, and/or type an AI prompt/topic. Uploads go to the existing private `storm-mailer-images` bucket (extended to accept documents); PDFs and articles are parsed and fed to the AI as source material for a unique letter.
2. **Message** — AI generates the letter from the verified storm facts + your topic/source docs. Editable afterward. Still never claims damage.
3. **Theme & tone** — pick a visual theme (bold 3D, clean modern, premium dark, friendly) and a tone/mood from the existing list.
4. **Signature** — personal (name / phone / email) or company (company name / email / phone), saved as a reusable default.
5. **QR code** — optional, with a free-form target URL; rendered into the letter.
6. **Generate** — renders a polished one-page letter with the user's company logo and brand colors at the top, storm facts, roof size, letter body, signature and QR. Saved against the address, printable/downloadable as PDF or copyable as email HTML.

### 5. Bulk export
A "Mailers" drawer on the Storm Intelligence page:
- Filter by campaign or view all saved mailers, with date-range and status filters.
- Address list shown in order, selectable.
- **Export all** produces a single PDF, one letter per page in list order, ready to print and stuff, plus a CSV address manifest in the same order.

## Technical notes

- Storm reads stay on the storm project via `stormSupabase` (auth untouched); all writes (properties, measurements, mailers, campaigns) stay on the app database via the authenticated client.
- Reverse geocoding uses the existing Mapbox token route; results cached per property to avoid repeat calls.
- New columns on `storm_mailers` for theme, QR target, source-document URLs and rendered HTML; a small migration adds them plus grants stay as-is.
- Letter rendering reuses the existing html2canvas → jsPDF pipeline used by reports, so bulk export is just page-per-letter concatenation.
- No auto-measuring anywhere: measurement only ever runs when you press the button for the selected house.
