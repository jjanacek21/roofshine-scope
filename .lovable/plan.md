# Fix "Couldn't save the measurement" on the roof step

## What's actually happening

The save does two writes:

1. The roof plan (outline + labeled lines) — succeeds. This is why the takeoff sheet later shows correct numbers and the wizard "skips" the measurement screen: the plan is already there.
2. The measurement summary row into `cb_measurements` — rejected by the database with `null value in column "raw" ... violates not-null constraint`.

Confirmed: `cb_measurements.raw` is NOT NULL with a default of `{}`, but the save explicitly sends `null` for it, which overrides the default and fails. Because that write throws, the code stops before navigating, so you see the error and have to back out manually.

## The fix

1. Never send `null` for `raw` — send the engine payload when there is one, otherwise an empty object. Same for the value loaded back from an existing row, so a re-save can't reintroduce the null.
2. Keep the current success behavior: save → straight to the roof takeoff screen.

No change to how the measurement wizard works — pin drop, trace, corner refinement, line drawing and labeling all stay exactly as they are.

## Technical detail

- `src/lib/cbMeasure.ts` → `saveCbMeasurement`: write `raw: (m.raw ?? {})` instead of `?? null`.
- `src/lib/cbMeasure.ts` → `CB_BLANK_MEASUREMENT.raw`: `{}` instead of `null`.
- `src/routes/cb.job.$id.measure.tsx` line 142: hydrate `raw: e.raw ?? {}`.
- No migration needed; the column default is already `{}`.
- Verify on the QA account: measure → label lines → Save → lands on the roof takeoff with the same numbers and no error toast.
