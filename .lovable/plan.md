
# Companies, Rep Invites & Virtual Rep Cards

Build out three connected features:
1. Super-admin can create companies and invite the first company admin in one flow.
2. Invited reps go through guided onboarding (password → profile → photo → bio → personal info).
3. Every rep gets a public virtual rep card (`/c/:slug`) with QR code, editable links, photos, documents, and an optional video intro.

---

## 1. Database changes

### Extend `profiles`
Add personal/profile fields used by onboarding and the rep card:
- `avatar_url`, `bio`, `title`, `mobile_phone`, `office_phone`
- `card_slug` (unique, lowercase, used in `/c/:slug`)
- `onboarding_completed_at` (null until wizard finished)

### New: `rep_card_blocks`
One row per content block on the card. Polymorphic by `kind`:
- `kind`: `link` | `photo` | `document` | `video`
- `title`, `subtitle`, `url`, `storage_path`, `thumb_url`, `sort_order`
- `user_id`, `company_id`, `is_visible`
- RLS: owner can CRUD own; company admins can view; **public read of blocks belonging to a profile that has a `card_slug`** (used by the public card page).

### New storage bucket: `rep-card-assets` (public)
For avatar, photo gallery, document uploads, video posters.

### Update `company_invites` RLS
Allow super admins to send `owner` / `admin` role invites (current policy blocks both for non-super-admins — keep that, just confirm super-admin path works for owner role).

### Public read access for cards
Add a SECURITY DEFINER RPC `get_public_rep_card(_slug text)` that returns the profile's public fields + visible blocks + company branding (name, logo). Avoids opening RLS on `profiles` to anonymous users.

---

## 2. Super-admin: Companies section

New route: `/admin/companies` already exists — extend it.

- "New Company" button opens a dialog:
  - Company name, address, phone, email, website, trades
  - Owner email + role (default `owner`)
  - On submit (server fn, super-admin only):
    1. Insert company.
    2. Create a `company_invites` row with role `owner`.
    3. Call existing `send-invite-email` edge function with the invite URL.
- Companies table lists all companies with: name, owner, # reps, # active invites, created date. Row click → company detail page.

New route: `/admin/companies/$id`
- Company info (editable).
- Reps list (profiles where `company_id = X`) with role, last login, onboarding status.
- Pending invites list with resend / revoke.
- "Invite rep" button → creates invite (any role except super_admin).

### Company-admin parity
Existing `/team` route already lets company admins manage their reps and invites — confirm it shows the same list and add a "View virtual card" link per rep.

---

## 3. Invite acceptance + onboarding wizard

Existing `/onboarding` route handles invite acceptance. Extend it:

After password is set and `accept_company_invite` runs, route the user to a multi-step wizard (`/onboarding/profile`) that updates `profiles`:

1. **Photo** — upload avatar to `rep-card-assets/avatars/{user_id}.jpg`.
2. **Basic info** — first name, last name, title, mobile, office.
3. **Bio** — textarea, 500 chars.
4. **Card handle** — pick `card_slug` (preview `/c/<slug>`), validates uniqueness live.
5. **Done** — sets `onboarding_completed_at`, redirects to dashboard.

Block dashboard access (in `_app` layout) until `onboarding_completed_at` is set if the profile has a `company_id` and was created via invite.

---

## 4. Virtual rep card

### Dashboard widget — `/card` (authenticated)
Rep's own editing surface:
- Live preview of their public card on the right.
- Left: editable profile fields, then a sortable list of blocks.
- Add Block dropdown: Link / Photo / Document / Video.
- Each block has inline edit + delete + visibility toggle + drag-to-reorder.
- "Share" panel:
  - Public URL (`https://app/c/<slug>`) with copy button.
  - QR code (use `qrcode` npm package, render to canvas/SVG).
  - "Text me the link" — opens SMS deep link `sms:?body=...`.
  - Download QR as PNG.

### Public route — `/c/$slug` (no auth)
- Server loader calls `get_public_rep_card` RPC.
- 404 if slug not found or profile not onboarded.
- Mobile-first single-column layout: company logo, avatar, name + title, bio, contact buttons (call / text / email), then ordered blocks:
  - Link → tappable card with title + favicon/icon.
  - Photo → lightbox-enabled gallery.
  - Document → downloads PDF.
  - Video → embedded player (YouTube/Vimeo embed or HTML5 for uploaded mp4).
- "Save to contacts" button generates a vCard download.
- SEO: `<head>` has rep name + company in title, og:image = avatar.

---

## 5. Implementation order

1. Migration: extend `profiles`, create `rep_card_blocks`, create bucket + policies, add RPC.
2. Super-admin company create/invite flow + companies detail page.
3. Onboarding wizard + dashboard guard.
4. Rep card editor (`/card`) with block CRUD.
5. Public `/c/$slug` page + QR + vCard.
6. Add "Virtual Card" entry to sidebar and to team list.

---

## Technical notes

- Use `qrcode` (npm) client-side; no server cost.
- vCard generation: small inline helper, no dependency.
- Public card page is a TanStack file route at `src/routes/c.$slug.tsx` (outside `_app`, no auth).
- All write operations go through `createServerFn` with `requireSupabaseAuth`. Super-admin-only ops verify `is_super_admin()` server-side, not just via RLS.
- Avatar/file uploads use the browser Supabase client directly to the `rep-card-assets` bucket, scoped by `auth.uid()` folder.
- Slug validation: lowercase, `[a-z0-9-]{3,40}`, unique index on `profiles.card_slug`.
