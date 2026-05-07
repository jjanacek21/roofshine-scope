## Batch select & delete photos

Add a multi-select mode to the Job Photos page so multiple photos can be deleted in one action.

### UX
- Add a "Select" toggle button in `PhotoFilterBar` (or just above the grid). When on:
  - Each `PhotoCard` shows a checkbox in the top-left corner.
  - Tapping the card toggles selection (instead of opening lightbox).
  - A sticky action bar appears showing "N selected" with "Select all (filtered)", "Clear", and a destructive "Delete N" button.
- When off, behavior is unchanged (tap opens lightbox).
- Exiting select mode clears the selection.

### Implementation
- `JobPhotosPanel.tsx`: add `selectMode: boolean` and `selectedIds: Set<string>` state. Add a `bulkDelete` mutation that, for each selected photo, removes the storage objects (`storage_path` + `_thumb.jpg`) and deletes rows via `.in("id", ids)`. Show toast with count, invalidate query, exit select mode.
- `PhotoCard.tsx`: accept optional `selectable`, `selected`, `onToggleSelect` props. Render a `Checkbox` overlay when `selectable`. When `selectable`, the card click calls `onToggleSelect` instead of `onView`.
- Confirmation dialog (`window.confirm`) before bulk delete, matching existing single-delete pattern.

### Out of scope
- No backend/RLS changes (delete already permitted).
- No changes to upload, analyze, or filter logic.