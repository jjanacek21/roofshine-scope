# Fix "Couldn't save the measurement" on the roof step

## What's actually happening

When you tap **Save roof measurements & continue**, the screen does two writes:

1. The roof plan (outline + labeled lines) — this one **succeeds**, and it is what quietly fills in the numbers you later see on the takeoff sheet.
2. The measurement summary row — this one is **rejected by the database**.

The database only accepts two values for a measurement's "source": `instant` or `manual`. The satellite engine hands back sources like `google_solar`, so the save is refused every time an AI-measured roof is saved. The error is also shown as "unknown error" because the database's real message isn't being read out, which is why it looked mysterious.

Because step 2 fails, the code stops before navigating — so you never get sent to the takeoff screen, even though step 1 already stored good numbers.

## The fix

1. Allow the real engine sources on the measurement row (database change), so a satellite-measured roof saves normally. Existing rows are untouched.
2. Normalize anything unexpected to a safe value before saving, so a future engine source can never block a rep again.
3. Read the real database error message so any future failure says what went wrong instead of "unknown error".
4. Keep the current behavior on success: save → go straight to the roof takeoff screen.

No change to how the measurement wizard works — pin drop, trace, corner refinement, footprint save, line drawing and labeling all stay exactly as they are.

## Technical detail

- Migration: replace `cb_measurements_source_check` with one that allows `instant`, `manual`, `google_solar`, `roof_plan`, `photo_ai`, `third_party_report`, `mapbox_draw`.
- `src/lib/cbMeasure.ts` → `saveCbMeasurement`: map any source outside that set to `instant`, and throw a real `Error` carrying `error.message` / `error.details` from PostgREST.
- `src/routes/cb.job.$id.measure.tsx` → `save()`: unchanged control flow; it will now reach the existing `navigate({ to: "/cb/job/$id/roof" })`.
- Verify on the QA account: measure → label lines → save → lands on the takeoff sheet with the same numbers, no error toast.
