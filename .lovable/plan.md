## Rep management + virtual card system

Three connected gaps: a global "Add rep" flow in the admin Users tab, the virtual rep card builder in the dashboard, and the public `/c/:slug` card with QR + share. (The "Manage" link on the Companies tab does work — it routes to `/admin/companies/$id`. You're already on that page in the preview; it just looks sparse for a brand-new company.)

### 1. Admin → Users: "Add rep" button

Edit `src/routes/admin.users.tsx`:
- Add a top-right "Add rep" button that opens a dialog with: email, first name (optional), last name (optional), **company** (searchable select of all companies), **role** (Admin or User — owner reserved for "create company" flow; super_admin not assignable here).
- On submit: call existing `create_company_invite_as_super_admin(_company_id, _email, _role)` RPC, then `send-invite-email` edge function with `/onboarding?invite=TOKEN`. Copy link to clipboard as fallback.
- Add columns/badges: company name (resolved, not just id slice), role pill (Admin/User), and onboarding pill ("Active" if `onboarding_completed_at`, else "Pending profile").
- Show a separate "Pending invites" section at the bottom listing all unaccepted invites across companies, with copy-link / resend / delete actions.

### 2. Virtual card builder at `/card`

New route `src/routes/_app.card.tsx` — two-pane editor: left = block list + add controls, right = live preview matching the public card.

**Top section (rep profile):**
- Avatar upload, headline (`title`), bio textarea, mobile / office phone, public email — write to `profiles`.
- Card handle (`card_slug`) inline edit with availability check via `is_card_slug_available`.

**Blocks (CRUD on `rep_card_blocks`):**
- "Add link" → title + URL (auto-detect icon: website, Calendly, Instagram, Facebook, LinkedIn, TikTok, YouTube, X).
- "Add photo" → upload to `rep-card-assets/<user_id>/photos/`, optional caption.
- "Add document" → upload PDF / image / doc to `rep-card-assets/<user_id>/docs/`, title (e.g. "Roofing License", "W-9").
- "Add video" → paste YouTube/Vimeo URL OR upload short clip to `rep-card-assets/<user_id>/video/`.
- Each block: reorder (up/down arrows on mobile, drag handle on desktop — updates `sort_order`), visibility toggle (`is_visible`), delete.

**Share panel (right column, sticky):**
- Public URL `https://<host>/c/<slug>` with copy button.
- QR code rendered client-side via `qrcode` package, with PNG download.
- "Text me the link" → `sms:?body=...`. "Email me the link" → `mailto:?subject=...&body=...`.
- vCard download built from profile + company.

### 3. Public card at `/c/:slug`

New route `src/routes/c.$slug.tsx` — mobile-first, no auth required. Loader calls `get_public_rep_card` RPC (already exists). Renders:
- Hero: avatar, name, title, company logo + name.
- Tap-to-call, tap-to-text, tap-to-email buttons.
- Save contact (vCard download).
- Blocks in `sort_order`: links as buttons, photos in a tap-to-zoom grid, documents as download cards with file-type icon, video embedded (YouTube iframe) or `<video>` for uploads.
- "Powered by" footer with company website.
- `head()` with rep name + title + `og:image` from avatar for SEO and link previews.
- 404 component when RPC returns null.

### 4. Sidebar + onboarding link

- Add "My Card" entry to the dashboard sidebar (gates on `onboarding_completed_at` — shows "Finish profile" deep-link to `/profile-setup` otherwise).
- After the existing `/profile-setup` wizard's final step, show a "Build your card" CTA that deep-links to `/card`.

### Technical notes

- `bun add qrcode @types/qrcode`. Render QR with `<canvas>` for easy PNG export.
- Reuse the existing public `rep-card-assets` bucket. All uploads written under `<auth.uid()>/...` so storage RLS allows owner-only writes but public reads.
- All authenticated writes use the browser Supabase client under the user session. `rep_card_blocks` RLS is `user_id = auth.uid()`; profile updates already guarded by row-owner policy.
- `c.$slug.tsx` uses anon client + `get_public_rep_card` (SECURITY DEFINER), so no auth required.

### Out of scope

- Card-view analytics.
- Custom card themes/colors per rep.
- Touch-drag reorder on mobile (use up/down arrows instead).