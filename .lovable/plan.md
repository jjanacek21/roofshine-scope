## Overview

Add a tenant-aware "Contract" capability to each job:
- New tables `tenants`, `tenant_users`, `contracts` + `contracts` storage bucket (public-read)
- A "Contract" tab in `JobTabs` opening a full-screen route with: type picker → embedded signing iframe → "Save Signed Contract" upload flow
- A Contracts list on the job Overview page
- Everything filtered by `tenant_id`; nothing about "GCN" hardcoded in React — pulled from tenant data

Note on existing schema: the project already has a `companies` table with one row per contractor and `profiles.company_id` linking users. Per the prompt's explicit naming, we'll add **new** `tenants` / `tenant_users` tables alongside (not replacing companies). The seeded GCN tenant is independent of the existing GCN `companies` row; the link between the two can be added later if needed (a `tenants.company_id` column is left nullable for that purpose).

---

## 1. Database migration

Tables (all in `public`):

**tenants** — exactly the columns in the prompt, plus a nullable `company_id uuid` for future linkage to `companies`.

**tenant_users** — as specified. `(tenant_id, user_id)` unique. `user_id` references `auth.users(id) on delete cascade`.

**contracts** — as specified. `contract_type` constrained to `('residential','insurance')`, `status` to `('pending','signed','cancelled')` via CHECK constraints. `job_id` references `jobs(id) on delete set null`.

Indexes: `contracts(tenant_id, job_id)`, `contracts(job_id)`, `tenant_users(user_id)`, `tenants(slug)`.

**Storage bucket**: `contracts`, public = true. RLS on `storage.objects`:
- SELECT: public (since bucket is public-read)
- INSERT/UPDATE/DELETE: only when `bucket_id = 'contracts'` AND first folder of `name` matches the caller's tenant slug (lookup via `tenant_users` → `tenants.slug`)

**RLS policies** (all tables RLS-enabled):

Helper SQL function `auth_tenant_id()` returning the caller's tenant_id from `tenant_users` (SECURITY DEFINER, stable, search_path=public).

- `tenants`: SELECT where `id = auth_tenant_id()`; super_admin ALL
- `tenant_users`: SELECT where `tenant_id = auth_tenant_id()`; super_admin ALL
- `contracts`: SELECT/INSERT/UPDATE where `tenant_id = auth_tenant_id()`; super_admin ALL. INSERT also requires `rep_user_id` belongs to the same tenant.

**Seed data** (idempotent — `on conflict (slug) do nothing` for tenants; `on conflict (tenant_id, user_id) do nothing` for tenant_users):
- One `tenants` row for GCN with all fields from the prompt
- Five `tenant_users` rows resolving `user_id` via `(select id from auth.users where lower(email) = lower($email))` — skip rows whose email isn't in auth.users yet so the migration doesn't fail. (User can re-run a follow-up seed later for any missing reps.)

`logo_base64` is left empty for now; user can paste it via a future admin panel.

---

## 2. Hook: `useTenant()`

`src/hooks/useTenant.tsx`:
- Reads current user via `useAuth`
- Joins `tenant_users` → `tenants` to return `{ tenant, tenantUser }` for the signed-in user
- Cached via React Query (`["my-tenant", user.id]`)
- Returns `{ data, isLoading }`. Components that need branding pull from `data.tenant`.

---

## 3. UI: Contract tab + route

**Add Contract to `JobTabs`** (`src/components/jobs/JobTabs.tsx`): new entry `{ to: "/jobs/$id/contract", label: "Contract", icon: FileSignature }`.

**New route** `src/routes/_app.jobs.$id.contract.tsx`: full-bleed page (the existing `_app.jobs.$id.tsx` layout still wraps it, so header + tabs remain — this matches how Photos/Measure work today). Page state machine:

```text
choose-type → signing → upload → done
```

### 3a. Choose-type view
Two large cards (`PrimaryCardButton` style — gradient border, var(--bg-card)):
- **Construction Agreement** (gold accent from `tenant.accent_color`) — sets `contract_type = 'residential'`
- **Insurance Contingency** (neutral) — sets `contract_type = 'insurance'`

Selecting a card transitions to `signing`.

### 3b. Signing view
Full-width responsive iframe (min-height: `calc(100vh - 280px)`, border var(--border), radius 14px) pointing to:

```
{SIGN_BASE_URL}/GCN-Sign.html?rep={tenantUser.rep_slug}
  &type={residential|insurance}
  &jobId={job.id}
  &tenantId={tenant.id}
  &customerName=...&customerPhone=...&customerEmail=...&propertyAddress=...
```

`SIGN_BASE_URL` = constant `https://sign.globalcontractor.network` in `src/lib/contract-config.ts` (single source so it's easy to swap later). All query params URL-encoded.

Below the iframe, a sticky action bar:
- Secondary "Back" → returns to `choose-type`
- Primary "Save Signed Contract" → opens upload dialog

**TODO comment** for future auto-save: `window.addEventListener("message", ...)` block sketched but disabled, with a comment: `// TODO: when GCN-Sign.html postMessages the signed PDF blob, auto-upload here instead of requiring manual file pick.`

### 3c. Upload dialog (shadcn `Dialog`)
- Heading: "Upload signed PDF"
- Body: native file input accepting `application/pdf` only
- On select: parse the filename to extract `document_id` (regex `/^(GCN-(RC|IC)-\d{6}-[A-Z0-9]+)\.pdf$/i`); if it doesn't match, show inline error and let the user retry
- "Upload" button:
  1. `supabase.storage.from('contracts').upload(\`{tenant.slug}/{job.id}/{document_id}.pdf\`, file, { upsert: true })`
  2. `getPublicUrl` → `pdf_url`
  3. Insert into `contracts` with `tenant_id`, `job_id`, `document_id`, `contract_type` (derived from RC/IC in document_id), customer fields from current job (and from `clients` table if available), `rep_user_id = tenantUser.id`, `pdf_url`, `signed_at = now()`, `status = 'signed'`, `raw_data = {}` for now
  4. `qc.invalidateQueries(["job-contracts", jobId])`
  5. Toast "Contract saved to job"
  6. Transition to `done` and reset to `choose-type` (or close back to job overview)

### 3d. Loading + error UX
- React Query loading skeletons for tenant fetch
- Try/catch around upload + insert with `toast.error(e.message)`
- Empty/missing tenant → friendly "Your account isn't linked to a tenant yet. Contact your admin." inline message (means seed didn't run for that user)

---

## 4. Contracts list on job Overview

In `src/routes/_app.jobs.$id.index.tsx`, add a new `Card` titled "Contracts" in the right column (below "Activity"), or as a full-width section above Notes — pick the right column to match the existing 65/35 layout.

Query `contracts` filtered by `job_id`, joined to `tenant_users` to display rep name. For each row:
- Mono `document_id`
- Type badge: gold "Construction" using `tenant.accent_color` for `residential`, neutral "Insurance Contingency" for `insurance`
- Customer name (from row)
- Date signed (formatted "Apr 29, 2026")
- Rep name
- "View PDF" → `<a href={pdf_url} target="_blank" rel="noopener">`
- "Email Customer" → `<a href={\`mailto:{customer_email}?subject=Your signed contract&body=Your signed contract: {pdf_url}\`}>`

Empty state: "No contracts yet. Open the Contract tab above to sign one."

---

## 5. Files to create / edit

**New:**
- `supabase/migrations/<timestamp>_contracts_feature.sql` — tables, RLS, helper fn, storage bucket + policies, seed data
- `src/hooks/useTenant.tsx`
- `src/lib/contract-config.ts` — `SIGN_BASE_URL`, document-id regex helper
- `src/routes/_app.jobs.$id.contract.tsx` — the full state-machine page
- `src/components/contracts/ContractTypePicker.tsx`
- `src/components/contracts/SigningFrame.tsx`
- `src/components/contracts/UploadSignedContractDialog.tsx`
- `src/components/contracts/JobContractsList.tsx`

**Edited:**
- `src/components/jobs/JobTabs.tsx` — add Contract tab
- `src/routes/_app.jobs.$id.index.tsx` — render `<JobContractsList jobId={...} />`

`src/integrations/supabase/types.ts` will be regenerated automatically — not edited by hand.

---

## 6. Build order (matches the prompt)

1. Migration: schema + RLS + bucket + seed → user verifies in Lovable Cloud
2. `JobTabs` Contract entry + route shell with type picker (placeholder iframe section)
3. Iframe wired with all URL params from `useTenant` + job data
4. Upload + insert flow with filename parsing + toasts
5. `JobContractsList` on job overview
6. Polish: skeletons, empty states, error toasts, missing-tenant fallback

## 7. Future-proofing (not built now)

- `postMessage` listener stub left as TODO in `SigningFrame.tsx`
- `tenants.company_id` column reserved for linking to existing `companies`
- All branding (`accent_color`, `company_name`, `logo_base64`, `legal_addendum_url`, `jurisdiction_state`) read from `tenant` — no hardcoded "GCN" string anywhere in components