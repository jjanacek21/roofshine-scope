# Stop review gaps from blocking Claim Buddy reports

## Goal
Let the inspector create the report with the information and photos already saved. Missing or optional items should be visible as warnings, never a dead end.

## Confirmed current state
- Recent affected jobs have multiple successfully saved inspection photos, but no `cover_photo_path` and no photo row categorized as `cover`.
- Cover capture currently queues the photo and immediately leaves the screen; the job cover path is only updated later after background upload and photo-row insertion both succeed.
- The review's upload count is device-wide, not limited to the current job.
- Takeoff completion scores every possible section, including sections that may legitimately have no items, then labels a score below 60% as a gap.
- The Create Report button is disabled for a missing cover, missing wide shots, or missing measured squares.

## Changes

1. **Make cover capture durable and visible**
   - Preserve the queued cover immediately as the job's intended cover instead of relying only on the final background step.
   - Keep the existing saved cover when retaking until the replacement finishes successfully.
   - Refresh the cover/review queries when the background upload completes.
   - Surface a failed queued upload with a retry action instead of silently deleting it after repeated attempts.

2. **Use a sensible report-cover fallback**
   - Resolve the report cover in this order: saved cover path, saved `cover` photo, first saved overview/wide inspection photo, then first saved inspection photo.
   - Show which saved photo will be used on review, so a report can still be created when the dedicated cover upload failed.

3. **Turn gaps into non-blocking warnings**
   - Keep customer details, takeoff completeness, upload status, cover status, wide-shot status, and measurement status visible as warnings.
   - Never disable **Create Report** because of those warnings.
   - If uploads for this job are still pending, let the inspector either wait/retry or create the report from everything already saved.

4. **Correct progress and upload scope**
   - Count queued photos only for the current job on its review screen.
   - Treat explicitly reviewed sections with zero selected items as complete rather than requiring irrelevant fields.
   - Rename the section to “Review notes” so it does not imply report creation is blocked.

5. **Verify the phone workflow**
   - Test: take cover → continue through inspection/takeoff → review → create report.
   - Test report creation with a failed cover upload but other saved photos.
   - Test report creation with optional takeoff sections left empty and with uploads still pending.

## Technical details
- Update the IndexedDB queue state to expose per-job pending/failed entries and completion events.
- Keep `cb_jobs.cover_photo_path` as the canonical persisted cover after a successful upload; use saved `cb_photos` rows for fallback selection.
- Reuse the same cover-resolution rule in review, report composition, shared report pages, and PDF rendering so all outputs agree.
- No database schema change is expected.