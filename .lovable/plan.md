## Problem

The Leads import says "No valid rows found" because the CSV columns are the raw Reonomy **contacts** export (`subject_address_full`, `contact_phone_1..5`, `contact_email_1..5`, multiple rows per property — one row per contact), but the parser in `src/routes/_app.leads.import.tsx` only recognizes:

- The merged Reonomy format (`street`/`address` + `contact_1_*`/`contact_2_*`/`contact_3_*`), or
- A raw format keyed on `address_full` (not `subject_address_full`).

So every row falls through `mapRow` and returns `null`. The server-side `importLeads` is already fine — it upserts by normalized address (merges new contacts into existing properties) and accepts up to 20 contacts × 20 phones × 20 emails per lead.

## Fix

Teach the client-side parser the third (raw contacts) shape and group multiple contact rows into one lead per property before sending.

### 1. Detect the Reonomy contacts shape

Add a third branch in `mapRow` (or a pre-step) that triggers when the row has `subject_address_line_1` or `subject_address_full` plus any `contact_name`/`contact_phone_1`/`contact_email_1`.

### 2. Group by property in `doImport`

Before mapping, group rows by a normalized property key:

```text
key = lower(trim(subject_address_line_1)) + "|" + city + "|" + state + "|" + zip
```

For each group:
- Property fields come from the first row's `subject_address_line_1` / `subject_address_city` / `subject_address_state` / `subject_address_postal_code`, with `reported_owner` from `reported_owner_name`.
- Contacts: one `ParsedContact` per row, deduped within the group by lowercased `contact_name`. Each contact collects:
  - `phones`: non-empty values from `contact_phone_1..5`, normalized to digits-only, deduped, length 3–40.
  - `emails`: non-empty values from `contact_email_1..5`, deduped, length 3–200.
  - `title` from `contact_title`, `company` from `contact_company_name`.
- Cap at 20 contacts per lead (server limit). Drop extras with a console warning.

### 3. Skip rows with no street

Rows where `subject_address_line_1` is blank AND `subject_address_full` has no street (e.g. just "Fl 33054") cannot be a property — skip them silently and surface a count in the toast ("1145 rows → 612 properties, 533 rows skipped (missing street)").

### 4. Merge behavior on the server

No server changes needed. `importLeads` already:
- Upserts leads by normalized address (the user's existing 1258 properties will be matched and updated, not duplicated).
- Inserts new contacts/phones/emails alongside existing ones for the same lead.

So re-importing this CSV will attach the new contact rows to the properties that already exist and create new lead rows for properties not yet in the table.

### 5. UI feedback

- Show "N properties · M contacts" next to the file name once parsing completes, so the user can see the grouping worked before clicking Import.
- Keep the existing batch progress and success toast.

## Files to change

- `src/routes/_app.leads.import.tsx` — extend `mapRow` / add a `groupContactsByProperty` helper, update `doImport`, update the preview header.

No database migration, no server function change.