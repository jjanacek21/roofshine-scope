## Goal

Let you register a brand new test company and confirm two things:
1. **Data isolation** — none of Global Contractor Network's leads, jobs, clients, estimates, photos, contracts, or invites show up.
2. **White-labeling** — the contractor's own company name and logo appear in the app chrome and on prospect-facing reports, not "GCN".

## What's already correct (verified, no change needed)

- **Database isolation**: every business table (`leads`, `jobs`, `clients`, `estimates`, `estimate_line_items`, `job_photos`, `job_property_analyses`, `lead_notes`, `lead_documents`, `lead_reports`, `companion_rules`, `company_macro_pricing`, `contracts`, etc.) has RLS that scopes reads/writes to `company_id = auth_company_id()`. A new company will see an empty workspace.
- **Invites & join requests** are also scoped to `company_id = auth_company_id()`.
- **Master catalog content** (`line_item_master` and `master_macros` rows with `company_id IS NULL`) is intentionally shared across all tenants — that's the platform-wide template library, not GCN's data.
- **Public rep card** (`/c/$slug`) already pulls the rep's actual company logo, name, phone, email from `companies` — already white-labeled per company.
- **Signup flow** is wired correctly: `/signup` → "Create new" → `/onboarding` → fills in company name + markup → inserts into `companies` and links the profile as `owner`.

## What needs to change for proper white-labeling

### 1. Sidebar/Topbar logo & app name
`src/components/brand/Logo.tsx` is hardcoded to render the chrome "G" mark + "GCN App". For a logged-in contractor, swap this for **their** company logo (`companies.logo_url`) and name when available; fall back to the GCN platform mark only on auth screens (login/signup/onboarding).

- Add a `useCompany()` hook that loads the current user's company (id, name, logo_url) via React Query, scoped to `auth_company_id()`.
- Update `Logo` to accept an optional `company` prop (or read from the hook when used inside `_app` routes). Render `<img src={logo_url}>` if present; otherwise the company's first initial in the chrome mark, with the company name as the wordmark.
- Keep the platform GCN logo on `/login`, `/signup`, `/onboarding`, `/forgot-password`, `/reset-password`.

### 2. Lead Savings report — currently hardcoded "GCN Lead Center"
`src/routes/_app.leads.savings.tsx` shows **"GCN Lead Center"** in the on-screen header (line 364), the generated PDF header (line 594), and the saved filename (`GCN_Savings_Report_…pdf`, line 229). This is a prospect-facing document — must reflect the contractor's own company.

- Read the user's company (name, logo_url, phone, email, website) via the same `useCompany()` hook.
- Replace the "GCN Lead Center" text with the company name; render `companies.logo_url` next to it (fallback to a neutral mark if no logo uploaded).
- Use the company name for the PDF filename: `{Company}_Savings_Report_{address}.pdf`.
- Use the company's phone/email in the report footer instead of any GCN contact.

### 3. Confirm no other contractor-facing screen leaks "GCN"
Audit hits for the literal "GCN" string land in three categories:
- **Platform chrome** (root `<head>` title, signup/login Logo, contract `DOCUMENT_ID_RE` regex matching `GCN-RC-…pdf` filenames) — these are platform-level identifiers, leave alone.
- **Sidebar Logo + Lead Savings report** — handled by changes 1 and 2 above.
- **`src/sign/GCN-Sign.html`** — separate signing app, out of scope for this change.

## How to test after the changes

1. Sign out of the current GCN admin account.
2. Go to `/signup`, create a fresh email (e.g. `+test1@…`) → step 2 pick **"Create new"** → continue → on `/onboarding`, fill in a fake company (e.g. "Acme Roofing Test"), markup `20`, finish.
3. Verify the sidebar/topbar now shows **"Acme Roofing Test"** (initial "A" mark, no logo yet).
4. Visit `/leads`, `/jobs`, `/clients`, `/team` → all should be empty (no GCN rows).
5. Upload a company logo from `/settings` (if available) → confirm the sidebar mark updates.
6. Open the Lead Savings flow → confirm the header and downloaded PDF say "Acme Roofing Test", not "GCN Lead Center".
7. Check `/admin/*` → not accessible (you'd be `owner`, not `super_admin`).

## Technical notes

- **Files touched**: `src/components/brand/Logo.tsx` (accept company prop / fallback), new `src/hooks/useCompany.tsx`, `src/components/layout/AppSidebar.tsx` and `src/components/layout/Topbar.tsx` (pass company into Logo), `src/routes/_app.leads.savings.tsx` (header + filename + footer).
- **No DB migrations**: `companies.logo_url`, `name`, `phone`, `email`, `website` already exist.
- **No RLS changes**: existing `Members view their company` policy already lets the logged-in user read their own company row.

Ready to implement on approval.