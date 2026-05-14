
## Goal

1. Audit the database for duplicate companies, leads, clients, jobs, profiles, and material catalog entries.
2. Auto-merge "safe" duplicates and produce a review report for the rest.
3. Make this Lovable Cloud backend usable from your other apps as a shared Supabase project.

---

## Part 1 — Duplicate audit & safe auto-merge

I'll write a one-time SQL audit script (run via the database tool, no UI build) that produces a report and performs only the safe merges automatically.

### Detection rules

| Entity | Duplicate signal | Canonical = the row that… |
|---|---|---|
| Companies | `lower(trim(name))` match | has the most members + leads + jobs combined; ties → oldest `created_at` |
| Profiles | `lower(email)` match | has a `company_id` set; ties → oldest |
| Clients | `(company_id, lower(email))` OR `(company_id, normalized phone)` OR `(company_id, lower(name) + lower(address))` | most-referenced by jobs; ties → oldest |
| Leads | `(company_id, lower(trim(address)) + zip)` OR rounded `(lat,lng)` to 5 decimals | most contacts/notes/activities; ties → oldest |
| Jobs | `(company_id, client_id, lower(property_address))` | most line items + photos + estimates; ties → oldest |
| Material catalog | `(company_id, lower(name), category_id)` | one referenced by recipes/templates; ties → oldest |

### "Safe" auto-merge criteria

A duplicate set auto-merges only if **all** are true:
- Exactly one canonical can be picked deterministically (no tie after rules above).
- Non-canonical row has **zero or strict-subset** child references (e.g. duplicate company with 0 leads/jobs/profiles, duplicate lead with no notes/contacts).
- No conflicting non-null field where both sides have different values on the same column.

Anything else lands in the **review report** — not touched.

### Merge mechanics

For each safe duplicate set:
1. Reassign FK references on every `company_id` / `client_id` / `lead_id` / `line_item_master_id` table (same broad UPDATE pattern we used for the Global Contractor merge).
2. Backfill any null fields on canonical from the duplicate's non-null values.
3. Delete the duplicate row.
4. Log the merge into a new `audit_log` entry (`action = 'auto_merge_dedup'`, metadata = `{entity, kept_id, removed_ids, fields_backfilled}`).

### Deliverables

- `audit_log` rows for every auto-merge (already-existing table).
- A CSV report at `/mnt/documents/duplicate-review.csv` listing every duplicate set that was **not** auto-merged, with columns: entity, signal, ids, member counts, conflicting fields. You review and tell me which to merge manually.
- Console summary: counts auto-merged vs. flagged per entity.

No app code changes — this is data-only.

---

## Part 2 — Sharing this backend with your other apps

Lovable Cloud is already a real Supabase project — your apps can connect to it directly. Nothing to migrate, no downtime.

### What I'll give you

Your project's connection details (these already exist; surfacing them for reuse):

- **Project URL**: `https://pqeheibflaetpcqzkral.supabase.co`
- **Project ref**: `pqeheibflaetpcqzkral`
- **Anon (publishable) key**: safe to embed in client apps — already in this app's `.env`.
- **Service role key**: server-only, never ship to a browser. You can pull it from this project's secrets when you need it for a backend.

### How your other apps connect

In each external app:

```ts
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(
  "https://pqeheibflaetpcqzkral.supabase.co",
  "<anon key>"
);
```

They will hit the same tables, respect the same RLS, and share the same `auth.users`. A user signed into one app is the same user in another (as long as they all use the same project).

### Things you should know before sharing

1. **RLS is the ONLY gatekeeper.** Today every table is scoped via `auth_company_id()` / `is_company_admin()`. That keeps tenants isolated. Any new app using the anon key gets the same protection.
2. **Auth providers are project-wide.** Whatever providers are enabled here (email/password, Google) work in the other apps automatically.
3. **Storage buckets are shared.** `roof-photos`, `contracts`, etc. are accessible to any app pointed at this project — the same bucket policies apply.
4. **Schema migrations should keep happening here.** If another app needs new columns/tables, add them via this project's migration tool so types stay in sync.
5. **Edge functions / TanStack server fns stay app-local.** Other apps can't reuse this app's server functions; they'd need their own server layer (or call public `/api/public/*` endpoints if you expose them).

### What I will NOT do

- I won't dump and restore into a separate Supabase account. You picked "connect my other apps to this same backend," which is the better option (zero downtime, shared `auth.users`, no schema drift).
- I won't change any RLS or auth settings in this pass.

---

## Order of operations

1. Run the duplicate audit (read-only first to preview counts).
2. Show you the preview, then run the safe auto-merges.
3. Drop `duplicate-review.csv` for your manual review.
4. Hand you the connection snippet + a 1-page README in `/mnt/documents/shared-backend-readme.md` your other apps can follow.

After you approve this plan I'll start with step 1.
