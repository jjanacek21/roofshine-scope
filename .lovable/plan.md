## Goal
Show the rep (creator/assignee) on every job and lead, and scope the lists so reps only see their own records while admins/owners see everything.

## Schema changes
- **`jobs` table**: add `created_by uuid` (set automatically) and `assigned_to uuid` (defaults to creator, editable by admins).
- **`leads` table**: already has `created_by`; add `assigned_to uuid` so leads can be re-assigned to another rep.
- Trigger on insert: if `created_by` is null, set to `auth.uid()`; if `assigned_to` is null, set to `created_by`.
- Backfill: set `created_by`/`assigned_to` for existing rows to the company owner so nothing disappears.

## RLS updates
- **Jobs SELECT**: `company_id = auth_company_id() AND (is_company_admin() OR created_by = auth.uid() OR assigned_to = auth.uid())`.
- **Leads SELECT**: same pattern.
- UPDATE/DELETE on jobs/leads: admins always; reps only on their own (`created_by` or `assigned_to`).
- Reassignment (`assigned_to` change): admins only — enforced via column check in policy.
- Super admins keep full access via existing policies.

## UI changes
- **Jobs list (`_app.jobs.index.tsx`)**: new "Rep" column showing assignee name (fallback to creator). Joined fetch from `profiles`. Add an "Assigned to me / All jobs" toggle for admins (admins default to All; reps only see their own and the toggle is hidden).
- **Job detail header (`_app.jobs.$id.tsx`)**: small "Created by {name} • Assigned to {name}" line. Admins get a dropdown to reassign to any company member.
- **New Job (`_app.jobs.new.tsx`)**: auto-stamp `created_by` (no UI). Admins see an optional "Assign to" select; reps' jobs auto-assign to themselves.
- **Leads list (`_app.leads.list.tsx`)**: add Rep column + same admin/rep filter + reassign action (admin only).
- **Lead detail**: show creator + assignee, admin can reassign.

## Hooks/helpers
- New `useCompanyMembers()` hook returning `{id, first_name, last_name}` from `profiles` filtered by current `company_id` (already covered by existing profile RLS for same-company members — verify or add policy).
- Extend existing job/lead query hooks to join the assignee/creator profile in one query (`select('*, assignee:profiles!assigned_to(...), creator:profiles!created_by(...)')`).

## Out of scope
- Bulk reassignment, notifications on assignment, activity log entries for reassignment (can be follow-up).
- Per-job custom permissions beyond admin/rep split.