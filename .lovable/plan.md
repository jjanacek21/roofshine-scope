# Split Door to Door into Sub-Tabs + Dispositions List

## Goal
Turn `/door-to-door` into a hub with two tabs:
1. **Enter World** — current full-screen map / session experience
2. **Dispositions** — list of every pin the user has dropped, filterable, with click-through to the map and one-click convert to a Job.

## Routing

```
/door-to-door                  → hub layout w/ tabs (default redirects to /door-to-door/dispositions)
/door-to-door/world            → existing map UI (current DoorToDoor page contents)
/door-to-door/dispositions     → new list view
```

Implementation:
- Convert `src/routes/_app.door-to-door.tsx` into a layout route that renders the two tabs + `<Outlet />`.
- New files:
  - `src/routes/_app.door-to-door.world.tsx` → renders existing `DoorToDoor` map page.
  - `src/routes/_app.door-to-door.dispositions.tsx` → new list page.
  - `src/routes/_app.door-to-door.index.tsx` → redirects to `/door-to-door/dispositions` so the tab hub is the landing page.
- Sidebar entry stays `/door-to-door`.
- "Enter World" tab label uses the existing `DoorOpen` icon; "Dispositions" uses `ListChecks` (or similar).

## Enter World tab
- No behavioral change — same map, GPS, session controls, side panel, video modals.
- Pins continue to save into `property_dispositions` via the existing `usePropertyDispositions` hook → automatically populates the Dispositions list (no extra plumbing needed).
- Add a small back-to-tabs header (or keep current full-screen and just rely on the sidebar). Recommendation: keep full-screen map; the tab bar lives on the hub layout but the world view renders edge-to-edge by hiding it when active. Simpler: tab bar is always visible at top, map fills the remainder.

## Dispositions tab (new)

### Data source
Query `property_dispositions` for `user_id = currentUser` (already RLS-scoped). Use TanStack Query with key `['dispositions', userId, filters]`.

### Columns / row content
- Disposition badge (color-coded via `src/lib/trades.ts`-style tokens, or a new map in `src/lib/dispositions.ts`)
- Customer name (fallback: "—")
- Address (fallback: reverse-geocoded coords or "Pin at lat,lng")
- Phone / Email (compact)
- Priority chip, tags
- Created / updated timestamp
- Row actions: **Open on Map**, **Convert to Job**

### Filters (top bar)
- Disposition multi-select (all enum values from `PropertyDisposition`)
- Search box (matches name, address, phone, email, notes)
- Priority filter (normal / high / urgent)
- Tag chips (derived from distinct `tags` values)
- Date range (created_at)
- "Has contact info" toggle (name OR phone OR email present)

Filters are local state; query fetches all then filters client-side (volumes per user are small). If a user exceeds ~1k pins we can move filters server-side later.

### Open on Map
- Click row (or "Open" button) → `navigate({ to: '/door-to-door/world', search: { lat, lng, propertyId } })`.
- World page reads `Route.useSearch()`, on mount flies the map to those coords and auto-opens `PropertySidePanel` for that property.

### Convert to Job
- Button per row + bulk action in selection mode.
- Opens a confirm dialog showing what will be copied.
- On confirm, creates a `jobs` row with:
  - `address`, `lat`, `lng` from the disposition
  - `customer_name`, `customer_phone`, `customer_email`
  - `notes` (prefixed with "Converted from D2D disposition …")
  - `source = 'door_to_door'`
  - `created_by` / `assigned_to` via existing `stamp_job_ownership` trigger
- Copy associated artifacts:
  - `property_photos` for that `property_disposition_id` → upload references / copy into `job-documents` bucket and insert `job_photos` rows (or whatever the existing job photos table is — confirmed during implementation by reading `JobPhotosPanel`).
  - `property_notes` history → append to job notes.
- Mark the disposition with `converted_job_id` (new nullable column) so the list shows a "Converted →" link instead of the button next time.
- Toast on success with a link to the new job; option to navigate immediately.

### Schema migration (single migration)
```sql
ALTER TABLE public.property_dispositions
  ADD COLUMN converted_job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  ADD COLUMN converted_at timestamptz;

CREATE INDEX idx_property_dispositions_user_updated
  ON public.property_dispositions (user_id, updated_at DESC);
```
(No new tables. Job creation reuses existing `jobs` insert + RLS.)

### Server function
`src/lib/d2d-convert.functions.ts`:
- `convertDispositionToJob({ dispositionId })` using `requireSupabaseAuth`.
  - Loads the disposition (RLS-scoped to user), inserts a `jobs` row, copies photos/notes, updates `converted_job_id`/`converted_at`, returns `{ jobId }`.

## UI details
- Tab bar: shadcn `Tabs` styled per design system (semantic tokens, Archivo, blue gradient active pill matching the existing primary button).
- List: shadcn `Table` on desktop, stacked cards on mobile (<768px), JetBrains Mono for phone/lat-lng.
- Empty state: "No dispositions yet — head into the World to drop your first pin" + CTA to Enter World tab.
- Loading: existing skeleton style.
- Toasts via `sonner` for save / convert.

## Files touched

New:
- `src/routes/_app.door-to-door.tsx` (rewritten as layout with tabs + Outlet)
- `src/routes/_app.door-to-door.index.tsx` (redirect)
- `src/routes/_app.door-to-door.world.tsx`
- `src/routes/_app.door-to-door.dispositions.tsx`
- `src/components/door-to-door/DispositionsList.tsx`
- `src/components/door-to-door/DispositionFilters.tsx`
- `src/components/door-to-door/ConvertToJobDialog.tsx`
- `src/lib/d2d-convert.functions.ts`
- `src/lib/dispositions.ts` (label + color map for all `PropertyDisposition` values)
- `supabase/migrations/<ts>_d2d_convert.sql`

Edited:
- `src/pages/DoorToDoor.tsx` — accept optional `?lat&lng&propertyId` search params to auto-focus a pin.

Untouched:
- All 30 existing D2D components, hooks, and the map itself.

## Out of scope (call out if you want them)
- Bulk export of dispositions to CSV
- Reassigning dispositions to other reps
- Server-side pagination (only needed past ~1k pins per user)
