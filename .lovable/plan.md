## Goal

Make signup company-aware so new users can either join an existing company (e.g. Global Contractor Network) or create a new one, and stop Michael Grosso's invite from opening with the wrong email.

## Part 1 — Company picker on signup

Today `/signup` only collects name/email/password, and `/onboarding` is where the user picks "Create company" vs "Join with invite". We'll surface that choice up-front on signup so the flow matches user expectations.

### New signup flow

1. **Step 1 — Account basics** (existing fields): first name, last name, email, password.
2. **Step 2 — Company affiliation** (new):
   - **Join an existing company** (default): searchable dropdown of companies. Selecting one creates a pending join request; user lands on a "waiting for approval" screen until a company admin approves them.
   - **Create a new company**: takes them to the existing onboarding "Create company" form after sign-up.
   - **I have an invite code**: paste the token, same as today's join flow.

### Backend changes

- New table `company_join_requests` (`id`, `company_id`, `user_id`, `status` enum `pending|approved|rejected`, `requested_at`, `decided_at`, `decided_by`).
- RLS:
  - User can insert/select their own request.
  - Company admins can select/update requests for their `company_id`.
  - Super admins can manage all.
- New RPCs (SECURITY DEFINER):
  - `request_to_join_company(_company_id uuid)` — creates a pending request for `auth.uid()`.
  - `approve_join_request(_id uuid)` — admin sets `profiles.company_id` + role `member`, marks request approved.
  - `reject_join_request(_id uuid)`.
  - `list_companies_for_signup()` — returns `id, name` only (so we don't expose other company data publicly via a view).
- Add a new tab on `/team` ("Join requests") showing pending requests with Approve/Reject buttons.

### Frontend changes

- `src/routes/signup.tsx`: convert to a 2-step form with the affiliation choice.
- `src/routes/onboarding.tsx`: keep "Create company" path; when user arrives with `?pending=1` show a "Waiting for admin approval" state.
- `src/routes/_app.team.tsx` + new `_app.team.requests.tsx`: list and act on pending join requests.

## Part 2 — Fix Michael Grosso's invite opening wrong email

The invite link works correctly today (it carries a token, not an email), but the user's browser is auto-filling a different Google/Supabase session, so accept lands on the mismatch warning we built last turn. We'll address it two ways:

1. **Preview email on the invite landing page before login.** Update `/onboarding` (and add detection on `/login` when `?invite=…` is present) so the page shows: *"This invite is for michael.grosso@rrcausa.com. You're signed in as X — switch accounts?"* with a one-click sign-out + sign-in button that pre-fills the invited email.
2. **Investigate Michael's specific invite row** to confirm the email on the invite matches what we expect, and re-issue if needed. We'll inspect `company_invites` for his pending row and either `update_company_invite_email` or delete + recreate via the Team → Invites edit flow we shipped previously.

### Open question

Do you want join requests to require admin approval (recommended — prevents randoms from joining GCN), or should picking a company auto-add them as a `member` with no approval step?

## Files to touch

- Migration: new `company_join_requests` table, RPCs, RLS.
- `src/routes/signup.tsx` — 2-step form with company picker.
- `src/routes/onboarding.tsx` — pending state + better invite preview.
- `src/routes/login.tsx` — show invite preview banner when `?invite=` present.
- `src/routes/_app.team.tsx` — add "Requests" tab.
- New `src/routes/_app.team.requests.tsx` — approve/reject UI.
- Data fix: inspect/repair Michael's `company_invites` row.
