# Fix the roof trace that still returns zero measurements

## Confirmed failure

The latest published attempt reached the roof AI successfully:

- AI Gateway request `01a02cc0-41f0-7be9-a332-7da4e69d4c52` at **2026-08-23 03:53:18 UTC** returned HTTP 200 in 5.9 seconds.
- The roof measurement updated at the same time still has **0 square feet and 0 roof sections**.
- The phone therefore shows the generic “Couldn't measure from satellite” message even though the model call itself worked.

This means the earlier change fixed the rejected AI request but did not verify that the returned outline survived parsing, validation, and saving.

## Fix

1. **Preserve the measurement wizard exactly as it is.** No layout, navigation, pin-drop, refinement, labeling, or takeoff changes.
2. **Make the AI response handling reliable.** Parse every supported streamed Responses API event shape, and distinguish an empty response, invalid JSON, invalid geometry, timeout, and save failure.
3. **Keep a valid traced outline.** Validate the raw AI polygon first. If “square up” post-processing makes a valid outline invalid, retain the original valid trace instead of discarding the entire measurement.
4. **Carry the real failure through the server function.** Replace the current generic `engine_error`/`bad_outline` path with a specific safe reason, log the validation stage and reason server-side, and show that reason in the existing toast.
5. **Add regression coverage.** Test a realistic streamed AI trace through parsing, validation, regularization, and the one-outline rule, including the case where post-processing must fall back to the valid raw polygon.

## Verification standard

Use the isolated QA account on phone width and perform the real flow:

1. Drop a pin on the demo roof and tap **Measure roof**.
2. Confirm the request finishes with one orange roof outline, non-zero area, and draggable points.
3. Confirm the database has exactly one saved section with non-zero area for that attempt.
4. Save the footprint, draw and label a line, then choose **Save roof measurements & continue**.
5. Confirm it opens the roof takeoff with the same non-zero measurements and no error toast.
6. Check the server and AI logs for that exact attempt.

A successful AI HTTP response alone will no longer count as a passing QA test.

## Technical scope

- `src/lib/roof-vision-trace.server.ts`: robust stream parsing and typed trace-stage failures.
- `src/lib/cb-measure.server.ts`: preserve valid raw geometry when regularization fails and propagate exact failure stages.
- `src/lib/cbMeasure.ts` and `src/routes/cb.job.$id.measure.tsx`: retain and display the server's specific failure reason.
- Measurement regression tests only; no other screens or features.
