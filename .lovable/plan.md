
## Door to Door — port plan

Bring the D2D / iCanvas feature from the export into this app, adapted to the current stack (TanStack Start, Lovable Cloud, multi-tenant `company_id` RLS, server functions instead of Supabase Edge Functions).

### 1. Database migration

Create one migration that adds:

**Enum**
- `door_to_door_disposition` (`not_home`, `not_interested`, `go_back`, `interested`, `needs_inspection`, `appointment_set`, `contract_signed`).

**Tables** — every table gets `company_id uuid not null` in addition to the export's columns, plus a `BEFORE INSERT` trigger that auto-fills `company_id` from `auth_company_id()` when null:
- `field_sessions`
- `door_knocks`
- `property_dispositions` (keep the unique `(user_id, lat_lng_hash)` index)
- `door_session_goals`
- `door_to_door_stats` (one row per user; aggregates stay per-user)
- `session_feed_posts`
- `session_feed_comments`
- `session_feed_reactions`
- `session_progress_videos`

**RLS — company-scoped:**
- SELECT: `company_id = auth_company_id()` on all tables (feed + leaderboard visible to teammates).
- INSERT: `user_id = auth.uid() AND company_id = auth_company_id()`.
- UPDATE/DELETE: `user_id = auth.uid()` (own knocks/posts/comments only); company admins (`is_company_admin()`) can moderate feed posts/comments.

**Triggers** (rewrite as `SECURITY DEFINER`, `search_path = public`):
- `update_door_to_door_stats` (after insert on door_knocks)
- `update_session_totals` (after insert on door_knocks)
- `update_stats_on_session_start` (after insert on field_sessions)
- New: `stamp_d2d_company_id` (before insert on each table) — mirrors the existing `stamp_lead_ownership` pattern.

**Realtime:** add the four tables to `supabase_realtime` publication.

**Storage buckets** (private):
- `door-to-door-videos`
- `feed-media` — keep private; serve via short-lived signed URLs from the components (consistent with the recent contracts hardening). Path layout: `{company_id}/{user_id}/...` so RLS scopes by first folder = company_id.

Storage policies: SELECT/INSERT/DELETE allowed when `(storage.foldername(name))[1] = auth_company_id()::text`.

### 2. Server function (replaces edge function)

`src/lib/d2d.functions.ts` — exports `logTrainingSession` (`createServerFn` + `requireSupabaseAuth`). Ports the logic from `supabase/functions/log-training-session/index.ts` (validates session ownership, inserts a progress video row, awards points). Helpers live in `src/lib/d2d.server.ts` to satisfy the serverfn-split rule. Wire `attachSupabaseAuth` is already registered in `src/start.ts`.

### 3. Frontend files

Copy from the export, adapted file-by-file:

- `src/hooks/useDoorToDoorSession.ts` — keep, swap all `supabase.from(...)` calls to include `company_id` on inserts (RLS still scopes selects automatically via the helper).
- `src/routes/_app.door-to-door.tsx` — new TanStack route wrapping the page component. No lazy/Suspense (handled by router). Replace `/member/dashboard` redirects with `/`.
- `src/components/door-to-door/` — port all 19 components verbatim, with these edits:
  - `DoorToDoorMap.tsx` — replace `import.meta.env.VITE_MAPBOX_TOKEN` with the existing `useMapboxToken()` hook (`src/hooks/useMapboxToken.ts`).
  - `PropertySidePanel.tsx` — remove imports of `InstantQuoteSection` and `GoodBetterBestCards` (stubbed — see below).
  - `InstantQuoteSection.tsx` and `GoodBetterBestCards.tsx` — port the files but replace data fetches with empty-state placeholders ("Pricing integration coming soon"). Keeps the visual scaffolding ready for later wiring without crashing on missing `quote_leads`.
  - Replace any `super_admins` checks with `is_super_admin()` (existing in this DB) or remove if only used for leaderboard visibility.
  - All `feed-media` public URLs swapped to `supabase.storage.from("feed-media").createSignedUrl(path, 3600)` calls (matches contract-list pattern).
  - Apply the project's design tokens: replace ad-hoc colors with semantic tokens from `src/styles.css`; headings use Archivo, numbers/codes use JetBrains Mono; cards use `var(--bg-card)` + 1px `var(--border)` + 14px radius. No raw `text-white` / `bg-black`.
- Toast imports already match (`sonner`). Replace any `useToast` from shadcn with `toast` from `sonner`.

### 4. Navigation

- `src/components/layout/AppSidebar.tsx` — insert `{ label: "Door to Door", icon: DoorOpen, to: "/door-to-door" }` after the SPF Prospecting entry.
- `src/components/layout/MobileBottomTabs.tsx` and `MobileSidebarSheet.tsx` — add matching entry. Mobile bottom bar already has 5 slots; demote "Guide" to the sheet and put D2D in the bar (or keep Guide and add D2D into the sheet only — quick decision at implementation).

### 5. Cleanup / out of scope

- No Supabase Edge Function deployed (the export's `log-training-session` becomes the server fn above).
- No changes to `src/integrations/supabase/*` generated files.
- `quote_leads` integration is stubbed, not implemented.

### Technical notes

- Stack: TanStack Start file-based routes (`src/routes/_app.*`) + TanStack Query loader pattern. No React Router DOM, no `App.tsx` route table edits.
- Auth: `requireSupabaseAuth` middleware on the server fn; browser uses the existing `@/integrations/supabase/client` import.
- Mapbox token: reuses `/api/mapbox-token` route already in the project — no new secret needed.
- RLS helper `auth_company_id()` already exists.
- Realtime channels in `SessionFeed.tsx` continue to work once the publication includes the new tables.
- Files created/edited (approx.): 1 migration, 1 server-fn file (+ helper), 1 hook, 1 route, ~19 components, 3 nav files. Total ~26 files.

### Open follow-ups (after this port)

- Wire `quote_leads` integration into the stubbed tabs when that table exists.
- Decide whether to add per-company leaderboard ranking (server fn aggregating `door_to_door_stats` joined to `profiles`).
- Decide if `field_sessions.storm_event_id` should reference an existing storm table or stay free-form.
