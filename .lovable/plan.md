
The user wants a hierarchical admin system:
- **Super admin** (platform-wide) — already exists, can see everything
- **Company admin/owner** (org-scoped) — can manage their own company's users only

Let me check what already exists. From the schema I can see:
- `app_role` enum: `super_admin | owner | admin | estimator | member`
- `is_company_admin()` function: checks if user is `owner` or `admin`
- `auth_company_id()` function: returns user's company_id
- `profiles` RLS already lets users see profiles in same company

So the data model is mostly there. What's missing:

1. **No company-admin UI** — `/admin` is super-admin only (gated by `is_super_admin()`). Company owners/admins have no admin surface.
2. **No way to invite team members** — owners can't add users to their company; users self-signup and pick a company.
3. **Onboarding doesn't let users join an existing company** — current `onboarding.tsx` only creates a new company. There's no "Join existing company" path.
4. **Profiles RLS gap for company admins** — owners/admins can SEE teammates but cannot UPDATE their roles. Only super_admin and self can update profiles.

## Plan

### Part 1 — Database (one migration)

**A. Profiles RLS: let company admins manage their team**
```sql
CREATE POLICY "Company admins update team profiles"
ON profiles FOR UPDATE TO authenticated
USING (company_id = auth_company_id() AND is_company_admin())
WITH CHECK (
  company_id = auth_company_id()
  AND role <> 'super_admin'  -- can't promote to super_admin
);
```
Company admins can change roles within their company but cannot create super_admins.

**B. Company invites table** — for the "invite teammate by email" flow
```sql
CREATE TABLE company_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'member',
  invited_by uuid NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
```
RLS: company admins manage their own company's invites; anyone can SELECT a row by token (for accept flow — actually we'll do this server-side instead).

**C. Optional: company directory for join-by-code**
Add `join_code text UNIQUE` to `companies` so a new signup can type a code instead of being invited by email.

### Part 2 — Routes

**New `/team` section (company-admin-scoped)** — separate from `/admin` (which stays super-admin)
- `_app.team.tsx` — layout, guard: requires `role IN ('owner','admin')`
- `_app.team.index.tsx` — list of users in MY company, with role dropdowns (member/estimator/admin/owner)
- `_app.team.invites.tsx` — pending invites; "Invite teammate" form (email + role); shows invite link to copy
- Pull "Invite teammate" entry into the topbar/sidebar for owners+admins

**Onboarding update — add "Join existing company" path**
`onboarding.tsx` gets a tab toggle:
- **Create company** (current flow)
- **Join with invite code** — paste the token from an invite link → server function looks up `company_invites` by token, sets `profile.company_id` and `role` from the invite, marks `accepted_at`

This needs to be a server function (`createServerFn`) using `requireSupabaseAuth` because the user's profile.company_id is null at this point and they need to be matched to the invite by email; the join logic has to bypass RLS via admin client OR be a SECURITY DEFINER function.

**Cleanest approach:** SECURITY DEFINER SQL function `accept_company_invite(_token text)` that:
1. Looks up invite by token, checks not expired, not accepted, email matches `auth.email()`
2. Updates caller's profile with `company_id` + `role`
3. Marks invite accepted
4. Returns company info

Then call it from the client via `supabase.rpc('accept_company_invite', { _token })`. No edge function needed.

### Part 3 — UI components

- `src/routes/_app.team.tsx` — guard layout
- `src/routes/_app.team.index.tsx` — team roster (mirror of admin/users.tsx but filtered to own company; role select limited to non-super_admin roles)
- `src/routes/_app.team.invites.tsx` — invite list + create form; copy invite link `https://app.../onboarding?invite=TOKEN`
- Update `onboarding.tsx`: detect `?invite=` in URL → switch to "Accept invite" mode → call RPC; otherwise show Create vs Join tabs
- Update sidebar (`AppSidebar.tsx`) to show "Team" link only when `is_company_admin()` (read role from profile in a small hook)

### Part 4 — Hierarchy summary

| Role | Can do |
|---|---|
| `super_admin` | Everything (already built — `/admin/*`) |
| `owner` / `admin` | Manage own company's users, invites, roles (NEW — `/team/*`) |
| `estimator` / `member` | Use the app, no admin surfaces |

Owners and admins are equivalent for now (both pass `is_company_admin()`). If you want owner > admin distinction later (e.g. only owner can demote other admins), say the word.

### What I'm NOT building this round
- Email-sending for invites (you'd need email infra wired up). For now invites generate a copyable link.
- Multi-company membership (a user belongs to one company, current model).
- Sub-teams / departments inside a company.

## Two quick questions

**1. Invite flow — how do new teammates join?**
- (a) **Invite link only** — admin generates a link, sends it via their own email/Slack/etc. (simplest, no email infra needed)
- (b) **Invite link + email send** — same but we also try to send via Resend (you have RESEND_API_KEY). Needs a server function.
- (c) **Both: link + a 6-char join code** anyone can type during signup

**2. Role limits for company admins**
- (a) Company admins can promote teammates up to `admin` (cannot create another `owner`, cannot touch `super_admin`)
- (b) Company admins can promote up to `owner` (full peer)

Default if you don't pick: **1b + 2a** (link + email, admins can't mint other owners).
