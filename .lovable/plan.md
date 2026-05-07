# Add Publish Toggle for Public Rep Cards

## Problem
Clicking "View card" shows "Card not found" because the public RPC `get_public_rep_card` requires `onboarding_completed_at IS NOT NULL`, which isn't set for super-admins (and won't be set for any rep until they finish onboarding).

## Solution
Replace the implicit onboarding-based gate with an explicit `card_published` boolean. Reps toggle their card live from the editor.

## Database (migration)

1. Add column: `profiles.card_published boolean NOT NULL DEFAULT false`.
2. Update `get_public_rep_card(_slug text)` to gate on `card_published = true` instead of `onboarding_completed_at IS NOT NULL`.
3. Backfill: set `card_published = true` for any profile that already has a `card_slug` set (so existing test cards work immediately).

## UI changes

### `src/routes/_app.card.tsx`
- Add `card_published` to the profile fetch + form state.
- In the **Share your card** panel, above the URL/QR:
  - A status pill: "Live" (green) or "Draft — not visible" (muted).
  - A switch labeled "Publish card" that PATCHes `profiles.card_published`.
  - When unpublished, dim the QR / link block and show "Publish to share."
- Disable the toggle (with helper text) when `card_slug` is empty — can't publish without a handle.
- "View card" link only opens in a new tab when `card_published === true`; otherwise show a tooltip "Publish first".

### `src/routes/c.$slug.tsx`
No code change needed — RPC change handles it. Existing 404 UI already matches.

## Out of scope
- Scheduled publishing, password-protected cards, per-block visibility (already exists), analytics on public views.
