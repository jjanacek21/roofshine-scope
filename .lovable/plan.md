
The user wants a LOT. Let me break this into what's reasonable for one round vs. what needs to be staged.

**Immediate problem:** They can't access `jared@globalcontractor.network`. They want to use `jaredjjanacek@gmail.com` as the super-admin and need to actually be able to log in.

**Big ask:** Full admin portal with user mgmt, feature flags, access control, memberships+pricing, CMS for home page, content/training videos, reviews+approval, analytics, email blasts, in-app announcements, help desk, AI customer support 24/7.

That's not one build. I need to scope this to a Phase 1 admin foundation that unblocks them today, then stage the rest.

## Phase 1 — Admin foundation (this round)

### A. Fix the email/login issue first
1. Confirm the new account `jaredjjanacek@gmail.com` exists. If they haven't signed up yet, they sign up at `/signup` — and because email confirmation is currently ON, a confirmation email goes to that Gmail. They click it, they're in.
2. **Disable email confirmation in dev** so they don't get blocked again while we're iterating. Can re-enable before going live.
3. Old `jared@globalcontractor.network` user — leave it alone, or delete after the new account works. Their pick.

### B. Super-admin role + dashboard scaffolding
The current `app_role` enum is `owner | admin | member` and `has_role()` already exists. I'll add a **`super_admin`** role (platform-wide, cross-company — distinct from per-company `owner/admin`).

- New helper: `is_super_admin()` — `STABLE SECURITY DEFINER`
- Once `jaredjjanacek@gmail.com` signs up, I'll grant them `super_admin` via a one-line SQL update.
- Add a route guard `_admin.tsx` that 403s anyone who isn't super-admin.
- Add `/admin` with a left nav for the sections below. Each section gets a real route file with placeholder content so the structure is real and we can fill it in iteratively.

### C. Admin routes (scaffold all, build the critical few)

```
/admin              Dashboard (platform stats: companies, users, MRR placeholder)
/admin/users        Manage Users  ← BUILD (list, search, role grant, disable/enable, password reset)
/admin/companies    Manage Companies  ← BUILD (list, view, suspend)
/admin/announcements      ← BUILD (create announcement, push to all dashboards)
/admin/emails       Email Blasts  (list users, compose — STUB until email infra is set up)
/admin/content      Home Page CMS  (STUB — schema only)
/admin/training     Training Videos  (STUB — schema only)
/admin/reviews      Approve Reviews  (STUB — schema only)
/admin/memberships  Plans & Pricing  (STUB — schema only)
/admin/features     Feature Flags  (STUB — schema only)
/admin/analytics    Analytics  (STUB — counts only)
/admin/support      Help Desk + AI Chat  (STUB)
/admin/audit        Audit Log  (STUB)
```

The 4 marked **BUILD** are functional in this round. The rest are real routes with "Coming soon" cards so the nav is complete and we can wire them up one at a time.

### D. Database additions (one migration)
- Add `'super_admin'` to `app_role` enum
- New table `announcements` (id, title, body, severity, audience='all'|company_id, created_by, created_at, expires_at) with RLS: super_admin can write; everyone reads active ones
- New table `audit_log` (id, actor_user_id, action, target_type, target_id, metadata, created_at) — append-only, super_admin reads
- Add `is_super_admin()` SQL function
- Update RLS on `companies` and `profiles` so super_admin can read/update across all companies

### E. User-side wiring
- Add an **announcement banner** at the top of `_app.tsx` that reads active `announcements` for that user's company or audience='all'

### F. Things I need to NOT do this round (will scope as follow-ups)
- Email blast sending — needs the Lovable email domain set up first
- AI customer support 24/7 — needs an edge function + chat UI + knowledge base
- Stripe/memberships — separate setup
- Training videos — needs storage bucket + upload UI
- Home page CMS — needs schema + editor UI

## Two questions before I execute

**1. The new admin account — has it been created yet?**
- (a) **I'll sign up `jaredjjanacek@gmail.com` myself at `/signup` right now.** Build the admin system; after I sign up, run the SQL to grant super_admin.
- (b) **Disable email confirmation first**, THEN I'll sign up so I get in immediately without checking Gmail.

**2. The old `jared@globalcontractor.network` account — what should happen to it?**
- (a) Delete it once the Gmail account works
- (b) Leave it — convert it to super_admin too so both emails work
- (c) Leave it but disabled

Pick one from each and I'll execute. Default if you don't pick: **1b + 2b** (disable confirmation so you're not locked out again, keep both accounts as super_admin).
