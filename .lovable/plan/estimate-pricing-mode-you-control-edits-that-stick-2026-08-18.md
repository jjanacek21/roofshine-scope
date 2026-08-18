# Estimate: pricing mode you control, edits that stick

Claim Buddy only. No GlobalContractor screen is touched.

## 1. Pricing mode

The two-mode segmented control, the price-per-square input, the plain-language
math sentence and the price book picker already exist on the estimate screen.
What is wrong is the behaviour around them:

- Switching mode **rebuilds the whole line list from scratch**, throwing away
  everything you changed. It will stop doing that: switching mode only changes
  how the same scope is presented (per square hides quantities and per-line
  prices, full line item shows them). Rebuilding becomes an explicit "Rebuild
  from takeoff" action with a confirm, and it warns you how many hand-edited
  lines it will replace.
- Saving in per-square mode currently **writes every quantity and price to
  zero**, so going back to full line item leaves an empty carrier estimate.
  Quantities and prices will always be stored; per-square mode simply doesn't
  display or total them.
- The default mode stays as it is (full line item when the measurement is
  complete, price per square when it isn't), and your saved mode always wins on
  re-entry.
- Price per square keeps saving as the workspace default.

## 2. Why your edits come back — and the fix

Four separate causes, all confirmed in the code and the data:

1. **Nothing saves unless you tap "Save estimate."** Leaving the screen by any
   other route loses the edit. Fix: autosave a debounced draft whenever a line
   changes, plus an explicit save.
2. **Duplicate estimate rows.** After the first save the screen still thinks no
   estimate exists, so the next save inserts a *second* estimate for the same
   inspection. The screen then reloads whichever row is newest. One job in the
   database already has 2 estimate rows. Fix: keep the saved estimate id in
   state and always update it; de-duplicate the existing rows for a job on load.
3. **A deleted line comes back.** Deletions are stored only by absence, so any
   rebuild re-derives the line. Fix: record removals so a rebuild cannot
   resurrect them (with an "Undo removals" control).
4. **A hand-edited quantity or price is overwritten** by a re-derived value.
   Fix: mark a line manual the moment you touch its name, quantity, price, unit
   or price-book pick. A manual line is never re-priced or re-quantified by a
   rebuild — it is carried through untouched and labelled "Edited by you."

## 3. Price book picker

The picker exists and searches `line_item_master`, showing code / name / unit.
Two gaps get closed: it is opened without the trade filter (so it always
searches everything), and the results row doesn't make the unit prominent. It
will pass the line's trade through with a "search all trades" toggle, and show
code / name / unit clearly.

## Technical notes

- Migration: add `estimate_line_items.is_manual boolean not null default false`
  and `estimates.removed_line_keys jsonb not null default '[]'`. Grants already
  exist on both tables; no new RLS surface.
- `src/lib/cbEstimate.ts`
  - `saveCbEstimate` — stop zeroing `qty`/`unit_price`/`total` in per-square
    mode; accept and persist an `estimateId` so it updates instead of
    re-inserting; persist `is_manual` and `removed_line_keys`.
  - `loadCbEstimateInputs` — return `is_manual` and `removed_line_keys`; when
    more than one estimate row exists for a `cb_job_id`, keep the newest and
    delete the strays.
  - New `mergeCbDraft(existing, rebuilt, removedKeys)` — keys derived lines by
    `line_item_id ?? code ?? name`; manual lines and removed keys win over
    rebuilt values; genuinely new derived lines are appended.
- `src/routes/cb.job.$id.estimate.tsx`
  - `changeMode` no longer calls `regenerate`; the header refresh button becomes
    an explicit "Rebuild from takeoff" with a confirm sheet.
  - `editLine`, `applyPick` and the blank-line action set `is_manual`; delete
    pushes the line key into `removedKeys`.
  - Debounced autosave (about 1.2s idle) plus save on unmount, reusing the saved
    estimate id; react-query cache updated on save so re-entry reads back what
    was written.
  - Per-square rendering hides the qty/unit/price row and the totals card, and
    shows the single price-per-square total with the arithmetic sentence.
- `src/components/cb/CbLineItemPicker.tsx` — accept and use the line's trade,
  add an "All trades" toggle, and show the unit in the result row.
