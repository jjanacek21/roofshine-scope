# Simpler roof measuring + stop losing photos

Two parts: rework the measure screen into "one footprint, then draw lines, then label", and fix the pre-flight gaps that keep blocking the report after photos are already taken.

## Part 1 — Measurement: one footprint, unlabeled lines, label by tapping

Today the traced result comes back as several colored facets, each edge is auto-guessed (eave/rake/hip...) and painted immediately. New behaviour:

1. **One facet.** After the pin measurement runs, the traced facets are merged into a single outer footprint outline for the whole roof. Squares/area still come from the engine's pitched math, so numbers don't change; the map just shows one shape instead of five.
2. **Nothing pre-labeled.** Every outline edge and every drawn line starts as "Unlabeled" and renders neutral white/grey. No automatic eave/rake guessing.
3. **Corners first.** Drag the corner handles (and midpoint handles to add a corner) until the outline matches the roof — unchanged behaviour, just now on one shape so there are far fewer handles.
4. **Draw the interior lines.** Line tool draws ridges/hips/valleys as plain lines; finishing a line no longer forces a type sheet — it just drops an unlabeled line.
5. **Label pass.** Tap any outline edge or drawn line to open the type sheet: Eave, Rake, Ridge, Hip, Valley, Gutter, Wall flashing, Step flashing, Transition. Labeled lines take their color and "Ridge 24 LF" chip only after they're labeled. A small counter shows how many lines are still unlabeled.
6. **One clear exit button.** The bottom bar becomes **"Save roof measurements & start takeoff"**, going straight to the takeoff screen (`/cb/job/:id/takeoff`) instead of the scope screen. Skip stays available.

## Part 2 — Report blocked even though photos and info were saved

Verified causes in the current code:

- `cb_jobs.cover_photo_path` is only written *after* the queued cover photo finishes uploading. If a single upload stalls (the "1 photo still uploading" pill), the pre-flight still reports "No cover photo".
- Photo uploads that fail 6 times are silently dropped from the queue with no error shown — the photo appears saved but never lands.
- The pre-flight's "X elevation has no wide shot" checks a counter kept on the takeoff sheet, not the actual photos in the database, so those gaps show even when wide shots exist.
- The cover screen always reopens the camera, with no "you already have a cover photo" state, which is why exiting and returning feels like it's making you retake everything.

Fixes:

- Write `cover_photo_path` as soon as the cover shot is taken (optimistic local record), then reconcile with the real storage path when the upload lands.
- Pre-flight gaps are computed from actual `cb_photos` rows (category `cover`, and `exterior` + `shot_type: wide` per elevation), falling back to the takeoff counters — so anything genuinely captured clears the gap.
- Cover screen shows the existing cover photo with "Keep this photo / Retake" instead of jumping straight into the camera. Same for elevations already having a wide shot.
- Failed uploads surface: a retry action on the pending pill and a toast when an item exhausts its retries, instead of disappearing.

## Technical notes

- Add `unlabeled` to the Claim Buddy edge type list (the database enum `roof_edge_type` already has it), grey color, and change `normalizeEdges` usage in the CB editor to default to `unlabeled` instead of auto-classifying. Totals math ignores unlabeled lines.
- Footprint merge: union/outer-boundary of the returned facet rings into one `CbPlanSection`; keep pitch on that section, keep the engine's `total_squares` / `total_area_sqft` untouched.
- Files: `src/components/cb/CbRoofPlanEditor.tsx`, `src/lib/cbRoofPlan.ts`, `src/routes/cb.job.$id.measure.tsx`, `src/routes/cb.job.$id.cover.tsx`, `src/routes/cb.job.$id.exterior.tsx`, `src/routes/cb.job.$id.review.tsx`, `src/lib/cbPhotoQueue.ts`.
- No database migration required.
