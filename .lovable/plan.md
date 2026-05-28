
## Goal

Three new capabilities in Door-to-Door:

1. Embed the existing jobs Measurement tool inline in the Property side panel and generate Good/Better/Best for Shingle, Tile, Metal, and Flat systems — replacing the broken "Get Instant Quote" with a real flow.
2. Add a third D2D sub-tab "Profile" alongside Enter World / Dispositions.
3. Profile drives a cross-company social layer: avatar/info editing, stats/level/badges/rewards, friend requests, a global news feed (with friends-only post option), and live D2D team chat.

---

## Part 1 — Measurement + GBB inline in Property Side Panel

### What lives where today
- `src/components/roof/MapboxRoofDraw.tsx`, `RoofMeasurementPanel.tsx`, `ManualMeasurementForm.tsx`, `MeasurementTotalsPanel.tsx` — the full roof draw + manual flow used in jobs.
- `src/components/door-to-door/InstantQuoteSection.tsx` + `GoodBetterBestCards.tsx` — currently calls a missing edge function, hence the red "Failed to send a request to the Edge Function".
- `src/lib/assemblies.ts`, `src/lib/roof-math.ts`, `src/lib/roof-system-templates.ts`, `src/lib/labor-rates.ts` — math + templates already power GBB pricing for shingle/tile/metal/flat in the jobs estimate.

### Changes
- **New component** `src/components/door-to-door/PropertyMeasureSection.tsx`
  - Reuses `MapboxRoofDraw` (compact mode, ~360px tall) seeded with the property's lat/lng.
  - "Or enter manually" toggle → reuses `ManualMeasurementForm`.
  - On save, persists `squares`, `predominant_pitch`, `facets`, `linear_footages` to `property_dispositions.measurement` (new jsonb column).
- **New component** `src/components/door-to-door/PropertyGBBSection.tsx`
  - System-type selector: Shingle | Tile | Metal | Flat.
  - Calls a new pure helper `src/lib/d2d-gbb.ts` that wraps `roof-math` + `roof-system-templates` to produce `{ good, better, best }` per system using the company's price book + labor rates (falls back to defaults).
  - Renders existing `GoodBetterBestCards` with the result. Selecting a tier saves it to `property_dispositions.selected_tier` + `selected_system_type`.
- **Replace** `InstantQuoteSection` usage in `PropertySidePanel` with `PropertyMeasureSection` + `PropertyGBBSection` stacked in the Details tab (above current Project Info). Delete reliance on the missing edge function.
- **Migration** — add to `property_dispositions`:
  - `measurement jsonb`
  - `selected_system_type text` (check in `('shingle','tile','metal','flat')`)
  - `selected_tier text` (check in `('good','better','best')`)
  - `selected_quote jsonb` (snapshot of the chosen tier's pricing for the Jobs conversion)
- **Conversion flow update** — `src/lib/d2d-convert.functions.ts` copies `measurement` + `selected_quote` onto the new job so the jobs estimate opens pre-populated.

---

## Part 2 — New "Profile" sub-tab in Door-to-Door

### Routing
- Add tab in `src/routes/_app.door-to-door.tsx`: Enter World | Dispositions | **Profile**.
- New routes:
  - `src/routes/_app.door-to-door.profile.tsx` — current user's profile dashboard (or `?userId=` for another user).
  - `src/routes/_app.door-to-door.feed.tsx` — global/team/friends feed (linked from Profile header).

### Profile page sections
1. **Header card**: avatar, display name, title, level badge, total/available points, daily streak.
2. **Stats grid** (from `user_gamification` + new aggregates): doors knocked, leads, appointments, contracts, conversion %.
3. **Badges** (from `user_badges` + `badges`): earned vs locked, hover for criteria.
4. **Rewards earned** (from `user_rewards` — new table if not present).
5. **Friends panel**: list, pending requests in/out, add/remove buttons.
6. **Edit Profile drawer**: first/last name, title, bio, mobile, avatar upload to `avatars` bucket (new public bucket).

---

## Part 3 — Cross-company social layer (DB)

All tables under `public`, with explicit GRANTs and RLS.

```text
profiles                       (existing — add: display_name, avatar_url already exists, cover_url)
friendships                    NEW
  id, requester_id, addressee_id, status('pending'|'accepted'|'blocked'),
  created_at, responded_at  -- unique(requester_id, addressee_id)
feed_posts                     NEW
  id, author_id, body, media (jsonb[]), visibility('global'|'friends'|'team'),
  company_id (nullable, for team scoping), created_at
feed_post_likes                NEW  (post_id, user_id, PK composite)
feed_post_comments             NEW  (id, post_id, author_id, body, created_at)
d2d_chat_messages              NEW
  id, session_id (nullable for global), company_id (nullable for global),
  scope('global'|'team'), author_id, body, created_at
user_rewards                   NEW  (id, user_id, reward_id, earned_at, redeemed_at)
```

RLS:
- `friendships`: requester or addressee can read; either side can insert/update their own row.
- `feed_posts`:
  - `visibility='global'` → readable by any authenticated user.
  - `visibility='friends'` → readable if accepted friendship exists with author.
  - `visibility='team'` → readable if same `company_id`.
  - Insert: any authenticated user; must equal `author_id`.
- `feed_post_likes`/`comments`: read if post is readable; write own row.
- `d2d_chat_messages`:
  - `scope='global'` → readable by all authenticated.
  - `scope='team'` → readable by same `company_id`.
  - Insert: any authenticated user; must equal `author_id`.
- `user_rewards`: read/write own row.

Realtime enabled for `feed_posts`, `feed_post_comments`, `feed_post_likes`, `d2d_chat_messages`, `friendships`.

Storage: new public bucket `avatars` (read public, write own folder by `auth.uid()`).

---

## Part 4 — Feed + Chat UI

- `src/components/feed/FeedComposer.tsx` — text + image/video upload to `feed-media` (existing public bucket), visibility selector (Global / Friends / Team).
- `src/components/feed/FeedList.tsx` — realtime list, like/comment.
- `src/components/feed/PostCard.tsx`, `CommentList.tsx`.
- `src/components/d2d/LiveChat.tsx` — bottom-anchored chat used inside Enter World, toggle Global ↔ Team.
- Friend system: `src/hooks/useFriends.ts` (request / accept / decline / remove / list).

---

## Technical Details

- All new components use semantic CSS tokens from `src/styles.css`; Archivo body / JetBrains Mono for numeric stats.
- GBB pricing helper is pure TS — no edge function, runs client-side using existing libs. This fixes the "Failed to send a request to the Edge Function" error by removing the network call.
- Mapbox token continues to use `/api/mapbox-token`.
- All Supabase writes via the browser client respect RLS; no `service_role` use.
- Feed media reuses existing `feed-media` public bucket; avatars use a new public `avatars` bucket.
- Build verification: run after migrations regenerate `types.ts`, then fix any column-shape drift in `useGamification`, `useDoorToDoorSession`, `usePropertyDispositions`.

---

## Open question (will ask after approval)

For "Team" chat scope I'm using `company_id`. If you have explicit D2D teams (sub-groups within a company), say the word and I'll add a `teams` + `team_members` pair instead. Defaulting to company-wide for now.
