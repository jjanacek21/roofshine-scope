## Problem

In the **New Assembly** dialog, checkboxes don't respond to clicks. The console shows repeated "Maximum update depth exceeded" errors originating from `src/routes/_app.jobs.$id.estimate.tsx:120` and the same pattern exists in `admin.macros.tsx`.

## Root cause

In `src/routes/admin.macros.tsx` (the `MacroEditor` component), this effect runs on every render:

```ts
const { data: existingItems = [], refetch: refetchItems } = useQuery({
  queryKey: ["admin-macro-items", macro?.id],
  enabled: !!macro?.id,   // disabled when creating a new macro
  ...
});

useEffect(() => {
  setSelectedIds(new Set(existingItems.map((i) => i.line_item_master_id)));
}, [existingItems]);
```

When the query is disabled (new macro) or returns nothing, `data` is `undefined`, so the destructure default `= []` creates a **brand-new `[]` reference every render**. The effect's dependency changes every render → `setSelectedIds` fires → re-render → infinite loop. This blocks the click handlers from settling, so checkboxes appear non-responsive.

## Fix

Replace the unstable default with a stable reference and only sync when we're actually editing an existing macro with loaded data.

In `src/routes/admin.macros.tsx`:

1. Remove the `= []` default from the destructure; keep `existingItems` possibly undefined.
2. Change the effect so it only runs when editing an existing macro and items have loaded:

```ts
useEffect(() => {
  if (!macro?.id || !existingItems) return;
  setSelectedIds(new Set(existingItems.map((i) => i.line_item_master_id)));
}, [macro?.id, existingItems]);
```

3. Update the few usages of `existingItems` further down (in `save()` and the `selectedItems` derivation) to fall back to `[]` locally where needed.

## Also fix the same bug in the estimate route

The console trace points to `src/routes/_app.jobs.$id.estimate.tsx:120`. I'll inspect that file in build mode and apply the same pattern (stable dep / guarded effect) so the `Maximum update depth` errors there are gone too.

## Files to change

- `src/routes/admin.macros.tsx` — guard the sync effect.
- `src/routes/_app.jobs.$id.estimate.tsx` — fix the analogous infinite-loop effect at/around line 120.

No schema or UI changes; behavior is identical except checkboxes will now toggle correctly.