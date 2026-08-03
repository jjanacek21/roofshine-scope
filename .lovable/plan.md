# Fix: can't add line items to an estimate

## What's happening

The estimate page is stuck in an infinite render loop. The browser console shows "Maximum update depth exceeded" repeating, traced to the estimate page. While that loop runs, React never settles, so the add-item picker and the save calls behind it stop working — the page looks alive but clicks don't stick.

## Cause

The line-items query result is copied into local state by an effect that re-runs whenever the query result changes identity. When the query has no data yet (no active estimate selected, or a refetch in flight), the fallback empty list is re-created on every render, so the effect fires, sets state, re-renders, and fires again forever.

## The fix

- Use a single stable empty-list constant for the query fallback so the effect's dependency stops changing identity on every render.
- Make the copy-into-local-state effect a no-op when the incoming list is already identical (same length and same row ids/values), so refetches after autosave don't churn state.
- Re-check the neighbouring effect that auto-creates the "Original" estimate and selects the active one, so it can't ping-pong with the same state update.

## Verification

Load the estimate page for the current job in the preview browser, confirm the console has no "Maximum update depth exceeded" errors, then add a catalog line item and a custom line item and confirm both persist after a reload.

## Technical notes

File: `src/routes/_app.jobs.$id.estimate.tsx` — the `useQuery(["estimate-items", activeId])` default value and the `useEffect(() => setLocalItems(items), [items])` at the top of the component. No database or schema changes.
