# Super admin: company control, tiers and feature gates

Give the Claim Buddy super admin panel full control over companies, users, plans and
what each plan can reach. Gating applies to Claim Buddy (gcn.claims) accounts only —
your internal GCN platform side keeps full access.

## Tiers

| Tier | Gets |
| --- | --- |
| Basic | Polygon draw measurements, own retail pricing macro, jobs, photos, reports, contracts |
| Pro | Everything in Basic + AI measurements + Survival Guide |
| Elite | Everything in Pro + Xactimate price book / carrier estimates + Storm Intel map |

Each feature is stored as its own flag on the company, pre-set from the tier but
individually overridable — so you can hand one company a single extra feature without
moving their tier. A "Comp / free access" switch marks a company as not billed and
leaves all features on regardless of tier.

## Company management

In the Companies tab, each company row expands to a management panel with:

- **Plan** — Basic / Pro / Elite selector; changing it resets the feature flags to that
  tier's defaults (individual overrides can then be re-applied).
- **Feature toggles** — AI measurements, Survival Guide, Xactimate price book, Storm
  Intel, plus AI measurement credit allowance.
- **Billing** — free/comp switch, seats purchased, trial and billing status.
- **Status** — Active / Suspended. Suspending blocks every member from signing into
  Claim Buddy immediately, with a message telling them to contact their admin.
- **Archive** — soft delete: company disappears from the app and all members lose
  access, but the data is kept. Archived companies show in an "Archived" filter with
  Restore, and a separate type-to-confirm **Permanently delete** action that erases the
  workspace and all its jobs, photos, measurements and reports.

## User management

Inside each company:

- Add a user by email with a role (Owner / Admin / Rep). They get an invite email with a
  link to set their password and finish setup. Re-send and revoke invite are available
  for anyone who hasn't accepted.
- Change a user's role, deactivate a single user (keeps their history, blocks login into
  that company), reactivate, or remove them from the company.
- A cross-company **Users** view listing every Claim Buddy user, their company, role,
  status and last activity, with search — so you can find someone without knowing which
  company they're in.

## How gating shows up to users

Blocked features are visible but locked rather than hidden: the Survival Guide button,
Storm Intel map, AI measure button and price-book estimate mode each show a small
"Upgrade" lock. Tapping it explains what tier unlocks it. The polygon draw tool and the
retail per-square macro stay available on every tier, so a Basic account can still finish
a full inspection and estimate.

Server side, every gated action is re-checked before it runs — AI measurement calls,
price-book reads and storm data queries refuse the request when the company's flag is
off, so the gate cannot be bypassed from the browser.

## Technical notes

- Migration on `cb_workspaces`: `tier` (basic/pro/elite), `status`
  (active/suspended/archived), `archived_at`, `is_comp`, and a `features` jsonb of
  boolean flags (`ai_measure`, `survival_guide`, `price_book`, `storm_intel`). Existing
  rows map free→basic, pro→pro, team→elite; the two Global Contractor workspaces are set
  to elite/comp so nothing you use today breaks.
- Members already have `is_active`; add `deactivated_at` for audit.
- `cb_my_context` returns tier, status and resolved feature flags per workspace so
  `CbSessionProvider` can expose a `can(feature)` helper; `useCbFeature` drives the lock
  UI in `CbDashboard`, `cb.map`, `cb.survival-guide`, roof measure and estimate screens.
- Suspended/archived workspaces are filtered out of `cb_my_context` and rejected by the
  Claim Buddy route gate.
- New super-admin server functions in `src/lib/cb-admin.functions.ts`:
  set tier/features/comp, set company status, archive, restore, purge, deactivate member,
  remove member, resend/revoke invite, list all users. Each re-verifies
  `cb_is_super_admin()` inside the handler.
- Invites reuse the existing `cb_invites` + Resend email path already used by the team
  screen, so the accept flow at `/cb/accept` needs no change.
- Admin UI work lands in `src/components/admin/CbCompaniesTab.tsx` plus a new
  `CbUsersTab.tsx` under the Claim Buddy admin route.
