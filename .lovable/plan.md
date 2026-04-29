## Goal

Add a super-admin UI to manage Contracting Tenants and their Reps so you (and future admins) can link/unlink user accounts to a tenant by email — no more hand-editing the database. Then use it to link your `jaredjjanacek@gmail.com` account to GCN.

## Why the current screen is empty

`useTenant()` looks up `tenant_users` by your logged-in `auth.uid()`. The seed migration created exactly one rep row for `jared@globalcontractor.network` (user `7af929a0…`), but you're signed in as `jaredjjanacek@gmail.com` (user `e728ce16…`), which has no `tenant_users` row → "Contracts not enabled."

## What gets built

### 1. New admin sidebar entry: "Contracts"
Add to `src/routes/admin.tsx` NAV list, icon `FileSignature`, route `/admin/tenants`. Super-admin only (existing guard already handles this).

### 2. New route: `/admin/tenants` (`src/routes/admin.tenants.tsx`)
Two-section page:

**Tenants section**
- Table of all rows in `tenants` (slug, company_name, jurisdiction_state, accent_color swatch, is_active toggle, contact info).
- "Edit" opens a dialog to update branding fields (`company_name`, `company_address`, `company_phone`, `company_email`, `company_web`, `accent_color`, `accent_color_dark`, `jurisdiction_state`, `legal_addendum_url`, `is_active`).
- "New tenant" button (slug + company_name required).

**Reps section (per selected tenant)**
- Table of `tenant_users` joined to `profiles` for that tenant: rep_name, rep_slug, rep_title, linked email (from profiles), is_active.
- "Add rep" dialog with fields:
  - User email (typeahead against `profiles.email` so you don't typo)
  - rep_slug, rep_name, rep_title, rep_phone, rep_email
  - On submit: look up `profiles.id` by email → insert into `tenant_users` with that `user_id`.
- Per-row actions: edit, deactivate (set `is_active=false`), delete, and a "Re-link to different account" action that just updates `user_id` after email lookup.

### 3. Server function for safe lookup
`src/server/tenant-admin.functions.ts` with `lookupUserByEmail({ email })` using `requireSupabaseAuth` middleware + a super-admin check, returning `{ id, email, first_name, last_name }` or null. RLS on `profiles` already allows super_admin select-all, so this is straightforward but keeps the email lookup off the browser bundle.

All other writes go through the browser supabase client because RLS already permits super-admins to manage `tenants` and `tenant_users` (the existing migration created `Super admins manage …` policies on both, per the schema dump).

### 4. Fix your account immediately
As part of this change, also insert a second `tenant_users` row linking `e728ce16-ccdb-437e-ab2a-0810312e189d` (jaredjjanacek@gmail.com) to the GCN tenant with rep_slug `jared-personal`, rep_name `Jared Janacek`, so the Contract tab works the moment the build finishes — without touching the existing `jared@globalcontractor.network` rep row.

## Files

- `src/routes/admin.tenants.tsx` (new) — page with tabs/sections described above
- `src/components/admin/TenantEditDialog.tsx` (new)
- `src/components/admin/TenantRepDialog.tsx` (new) — used for both add and edit
- `src/server/tenant-admin.functions.ts` (new) — `lookupUserByEmail`
- `src/routes/admin.tsx` — add nav entry
- Data insert (no schema change needed): one `tenant_users` row for your gmail account

## Out of scope

- No new tables or RLS changes (existing super_admin policies cover it).
- No multi-tenant-per-user support; `useTenant()` still picks the first active link.
- No invite-by-email flow for reps yet — admin must add reps for users who have already signed up.

## How you'll use it after the build

1. Reload the app, open the sidebar → Admin → Contracts.
2. You'll already see GCN listed and your gmail account linked as a rep (auto-seeded by this change).
3. Click into a job → Contract tab works.
4. To add a new rep later: Admin → Contracts → GCN → "Add rep" → type their email → fill rep_slug + rep_name → save.
