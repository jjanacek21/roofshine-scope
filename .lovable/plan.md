## Problem

When you open a lead's detail sheet and click **Open Playbook**, the floating Call Playbook panel appears behind the sheet's dim overlay/content. The panel's stored position defaults to the right side of the screen — which is exactly where the lead detail sheet renders — and its `z-50` stacking matches the sheet's overlay, so it's effectively hidden.

## Fix

Two small changes to `src/components/leads/CallPlaybookPanel.tsx`:

1. **Raise the stacking layer.** Change the panel wrapper from `z-50` to `z-[100]` so it sits above the lead detail sheet (which uses Radix Dialog at `z-50`).

2. **Reposition when it opens over a sheet.** When the panel transitions from closed → open, re-anchor it to the **left side** of the viewport (`x: 24`, `y: 80`), regardless of any stale stored position. This guarantees it's visible next to (not under) the right-side lead sheet. The user can still drag it anywhere; the new position is then persisted as today.

   Implementation detail: add a `useEffect` keyed on `open` that, on each open, sets `pos` to `{ x: 24, y: 80 }` if the current `pos.x` would place the panel within the right 480px of the viewport (i.e. behind the sheet). Otherwise leave it.

No other files change. The lead detail sheet, `useCallPlaybook`, and the trigger button stay as-is.
