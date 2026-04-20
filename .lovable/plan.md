

## Two issues, two fixes

### Issue 1 — Photo upload silently fails / shows "0 photos uploaded"

**What's wrong**: I checked the database — `job_photos` for this job is **completely empty**, even though you've tried uploading. Storage and DB RLS policies are correct, and the upload code path looks fine in theory, but the current uploader has three weak spots that produce a silent failure with no useful error:

1. The whole upload runs in **one loop with one shared `try`** — if file #1 fails (HEIC decode, oversized file, network blip, EXIF parse hang on a weird file), the loop aborts and **none of the remaining files upload**. You see one generic toast and no diagnostics.
2. **No console logging** of the actual Supabase error message — when the storage upload returns `{ error }`, we throw it but never log it, so the browser console stays empty.
3. The thumbnail uses `<img>` which **cannot decode HEIC** in most browsers — iPhone photos will throw before they even reach the DB insert. Thumbnail is "best-effort" but the storage upload itself might also be failing on `.heic` extensions that the bucket validates oddly.

**Fix in `src/components/jobs/PhotoUploader.tsx`**:
- Wrap **each file** in its own try/catch so one bad photo doesn't kill the whole batch.
- Track `failed` count alongside `succeeded`; toast shows `"X uploaded, Y failed"` instead of a single number.
- `console.error` every failure with the file name + the real Supabase error message so you (and I) can see exactly what's wrong in DevTools.
- Skip thumbnail generation entirely for HEIC/HEIF (they'll still be uploaded; we just don't try to make a thumb the browser can't decode).
- For HEIC, force the stored extension to `.heic` (lowercase) and set `contentType: "image/heic"` on the storage upload so the bucket accepts it cleanly.

### Issue 2 — "Measurement report isn't saved anywhere"

**What's actually happening**: I checked the database — your measurement **is saved**: `2,959 sqft, 29.6 squares, mapbox_draw, last updated 13:57 today`. The save worked. The problem is **discoverability** — after you click Save in the Mapbox tab, nothing in the UI confirms "here's your saved measurement, view it here." You navigate away and there's no obvious place that says "you have a saved measurement for this property."

**Fix in two places**:

1. **`src/components/roof/RoofMeasurementPanel.tsx`** — add a "Saved measurement" summary card at the top of the panel (above the tabs) when an existing measurement is loaded:
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ ✓ Saved measurement · updated 2 min ago                 │
   │ 29.6 SQ · 2,959 SF · 6/12 pitch · 15% waste             │
   │ Source: Mapbox Draw                                     │
   │                                  [ View in Report → ]   │
   └─────────────────────────────────────────────────────────┘
   ```
   This makes it immediately obvious that the measurement saved and where it lives. The "View in Report" button navigates to `/jobs/$id/report` where the full Measurement Report section already renders (it's been there the whole time — you just couldn't tell).

2. **`src/routes/_app.jobs.$id.report.tsx`** — the Measurement Report section currently only renders inside the proposal preview. Pull a small "Saved measurements" summary card to the **top of the Report page**, above the proposal preview, so when you land on Report you see at a glance: roof sections list, totals, "this came from your Mapbox Draw on April 20." Same data, just elevated so it isn't buried inside the styled preview.

## Files touched

- `src/components/jobs/PhotoUploader.tsx` — per-file try/catch, HEIC handling, real error logging, "X uploaded / Y failed" toast.
- `src/components/roof/RoofMeasurementPanel.tsx` — "Saved measurement" summary banner with deep-link to Report.
- `src/routes/_app.jobs.$id.report.tsx` — surface a top-of-page "Measurement Summary" card so it's findable.

## Out of scope

- No DB or RLS changes (both are correct).
- No changes to the Mapbox draw flow itself or the property-wide AI analysis.
- No changes to the report PDF generator.

## After this ships

- Drop photos → either they all upload (and the count is right), or you get a toast like **"3 uploaded, 1 failed — check console"** with the exact Supabase error printed, so we can diagnose any remaining bucket/MIME issue in one round trip.
- Save a measurement → immediately see the green "Saved measurement" card with totals, plus a one-click jump to the Report tab where the full breakdown lives.

