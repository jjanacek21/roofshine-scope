# Claim Buddy: companies, users, roles, seats and emails

Build a company/user database in the super-admin Claim Buddy tab, owner/admin/rep roles with real visibility rules, Stripe seat purchases for owners, and Resend emails for invites, signups and demo requests.

## 1. Roles: owner / admin / rep

Today Claim Buddy workspaces use `admin / manager / rep`. Remap to:

- **Owner** — full control of their Claim Buddy admin portal (branding, pricing, catalog defaults, team), sees every inspection and disposition in the company, and is the only role that can buy seats.
- **Admin** — everything the owner can do except buying seats.
- **Rep** — sees only the inspections they created and the doors they pinned in map mode.

Existing `admin` members become owner (first/oldest member per workspace) or admin; existing `manager` members become admin. Role labels update everywhere they appear.

## 2. Super-admin company & user database

New **Companies & Users** section inside the existing Claim Buddy admin tab:

- Table of all Claim Buddy companies: name, plan, seats used / seats purchased, members, inspections, created date.
- Create a company (workspace + company profile: name, logo, phone, email, website, address, license numbers).
- Open a company to edit that info, adjust its purchased seat count, and manage its people.
- Add a user: email, name, role, company. Sends an invitation email with a link to accept and set a password. Existing accounts are simply attached to the company.
- Change a user's role, move them between companies, deactivate or remove a seat.
- Resend or revoke a pending invite.

## 3. Owner / admin portal inside Claim Buddy

The existing `/cb/admin` Team screen becomes seat-aware:

- Seats used vs purchased, with invites blocked once seats run out.
- Invite reps by email (invitation email + password setup), change roles, deactivate.
- **Buy more seats** — owner only — opens Stripe checkout for additional seats; the purchased seat count updates automatically when payment completes. Admins see the seat counter but no purchase button.
- Admins get every other control the owner has.

## 4. Who sees what

- Reps: only their own inspections and only the dispositions they pinned.
- Owners/admins: every inspection and disposition in their company.
- The Claim Buddy dashboard and the Dispositions tab gain **filter by rep** and **filter by status** for owners and admins (hidden for reps).

Enforced in the database (row-level rules), not just in the UI, so a rep cannot reach another rep's data.

## 5. Emails (Resend)

Templates and endpoints, all branded Claim Buddy / GCN:

- **Invitation** — "You've been invited to <Company> on Claim Buddy", link to accept and set a password.
- **Signup confirmation** — sent when someone signs up from the app or the future gcn.claims landing page.
- **Demo request** — confirmation to the requester plus a notification to your inbox; requests are stored so you can see them in the super-admin portal.

The signup and demo endpoints are public POST endpoints so the landing page you're building can call them directly with no extra work.

## Technical notes

- Migration: rewrite the `cb_workspace_members` role check to `owner|admin|rep` and migrate existing rows; add `seats_purchased` to `cb_workspaces`; update `cb_role`, `cb_is_admin`, `cb_sees_all` so owner+admin see all; add an `cb_is_owner` helper for seat purchase.
- `property_dispositions` gets a `workspace_id` column (backfilled from the pinning user's workspace) plus policies: own rows always, workspace-wide for owner/admin. Map mode writes the workspace id on insert.
- Invites use the existing `cb_invites` table with a token, expiry and role; acceptance goes through a server function that creates or links the auth user and seats them. Password setup uses Supabase recovery/invite links.
- Emails move to server functions in `src/lib/cb-invite.functions.ts` using `RESEND_API_KEY` (already configured); public routes `src/routes/api/public/demo-request.ts` and `signup-notify.ts` for the landing page, with zod validation and rate-limit-friendly handling.
- New `cb_demo_requests` table (name, company, email, phone, seats, message, source) with super-admin-only read.
- Stripe seats: enable the Lovable Stripe integration, create a per-seat checkout session in a server function, and update `seats_purchased` from the verified webhook.
- Super-admin screens are added as tabs in `src/routes/admin.claim-buddy.tsx` with a detail route for a single company; all writes go through service-role server functions that verify `super_admin`.
