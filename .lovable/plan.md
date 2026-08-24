# Marketing content backend — finish the gaps

Most of Part 1 already exists from earlier work: the five tables are created with RLS,
the `marketing` bucket exists with public-read plus super-admin write policies, the two
required indexes exist, and all 11 content blocks are seeded with the real landing-page
copy (hero, measure_player, steps, inspections, why_switch, quote, about, cta,
pricing_intro, resources_intro, demo_intro). 65 photos are already uploaded.

Verified gaps against your spec:

- `cb_site_media` has no `media_key` column, so re-uploading a screenshot creates a
  duplicate row instead of replacing it in place.
- The `marketing` bucket is currently private (the site signs URLs to read it); the spec
  asks for a public bucket.
- No `updated_at` trigger is attached to any of the five tables.
- The photo uploader caps at 2 MB, converts to JPEG, has no per-file progress, no
  manifest support, no "Replace image" button, and reorders with arrow buttons rather
  than drag.
- `/admin/claim-buddy` has no route-level super-admin gate — a non-super-admin who types
  the URL still reaches the page.

## What I will do

### 1. Migration
- Add `media_key text` to `cb_site_media`, backfill from the existing storage paths using
  the same normalization the public site already uses, then set NOT NULL + UNIQUE.
- Make the `marketing` bucket public (storage policies stay as they are).
- Attach the existing `public.cb_touch_updated_at()` BEFORE UPDATE trigger to all five
  tables.

No changes to existing RLS, other tables, or the estimate catalog.

### 2. Photo uploader (rewrite of the Photos sub-tab)
- Multi-file drop zone built for 60+ files at once, with a per-file progress list
  (queued / resizing / uploading / done / failed) that keeps going past failures.
- Per file: reject non-images and anything over 5 MB, downscale to 900 px on the long
  edge, encode WebP (JPEG fallback if the browser can't encode WebP).
- `media_key` = filename minus extension, lowercased. If the key already exists, the file
  is replaced in place: same row, same key, new object; the old object is deleted.
- Optional `manifest.json` dropped with the images fills title, caption and category per
  media_key. Otherwise title = filename, category = `other`.
- Grid grouped by category: edit title/caption/category, drag to reorder within a
  category, toggle published, "Replace image", and delete that removes both row and
  storage object.

### 3. Content sub-tab
Already lists blocks with generated inputs/textareas/chip lists and saves the jsonb.
I will add the `updated_at` timestamp display and a "Preview" link to the public page.

### 4. Access control
Add a super-admin gate on `/admin/claim-buddy` that calls `cb_is_super_admin()` and
bounces anyone else to the app home with a refusal message, so typing the URL is not
enough.

## Verification I will run
Sign in as the QA super admin, drag in five images, and report each `media_key` and
storage path. Re-upload one with the same filename and confirm the row count is unchanged
and the object was swapped. Edit the hero headline, save, reload, confirm persistence.
Then confirm a non-super-admin session is bounced from the URL. Finally, load the public
landing page and confirm it renders identically.

## Untouched
Landing page rendering, measurement engine, tracer, takeoff, existing estimate catalog
tabs, existing RLS policies.
