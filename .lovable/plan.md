# Smart Duplicate Handling on Lead Import

Today the importer already skips leads whose address exists for the company, but it always tries to add their contacts. Two problems:

1. A duplicate row with the same contact info still creates noise (we treat "no new contacts" as success).
2. There's no clear signal back to the user about how many were skipped vs. merged vs. created.

You want: **address-based dedupe** with **contact-aware merge** — only "replace/enrich" the existing lead when the new row brings contact info that wasn't already on it.

## Behavior

For each address in the import file:

- **Address not in system** → create new lead + insert all contacts/phones/emails. Counts as **created**.
- **Address already in system, no new contact info** → fully skip. Lead untouched. Counts as **skipped (duplicate)**.
- **Address already in system, brings new contact info** (a contact name we don't have, OR an existing contact gains a new phone/email) → keep the existing lead row, merge in the new contact data only. Counts as **merged**.

"New contact info" rules:
- New contact = `(lead_id, lower(name))` not already present → insert contact + its phones/emails.
- Existing contact + new phone = phone string not already on that contact (case-insensitive, digits-only compare) → insert phone.
- Existing contact + new email = email not already on that contact (lowercased) → insert email.
- If after applying these rules nothing would be added, the row is a true duplicate → skip.

We do **not** overwrite existing fields on the `leads` row itself (owner, sqft, etc.) — only enrich contacts. This avoids destroying manually-edited data.

## Implementation

**File: `src/server/leads.functions.ts` — `importLeads` handler**

Replace the current "insert leads → insert contacts" block with:

1. Look up existing leads by address for the chunk (already done).
2. Insert only the addresses that don't exist (already done) — track them as `created`.
3. For every row whose address already existed, **before inserting any contacts**, fetch:
   - existing `lead_contacts` for that lead (id, name)
   - existing `lead_contact_phones` for those contact ids (contact_id, phone)
   - existing `lead_contact_emails` for those contact ids (contact_id, email)
4. For each incoming contact:
   - normalize name (`trim().toLowerCase()`), phones (digits only), emails (lowercased)
   - if contact name not in existing set → queue full insert (counts row as `merged`)
   - else compute phone/email diffs against the existing sets; if any non-empty → queue inserts on the existing contact id (counts row as `merged`)
   - else → contribute nothing (row stays `skipped` unless another contact on the same row qualifies)
5. Apply the same insert pipeline (contacts → phones → emails) using the queued items.

Counters returned by the server function become:
```
{ created, merged, skippedDuplicates, contactsInserted, phonesInserted, emailsInserted, errors }
```

Per-chunk batching stays the same (LEAD_CHUNK=200, CONTACT_CHUNK=300, sub-chunks of 500). Lookups for existing phones/emails are batched by `contact_id` `IN (...)` to keep round-trips bounded.

**File: `src/routes/_app.leads.import.tsx`**

- Sum `created`, `merged`, `skippedDuplicates` across chunks alongside the existing totals.
- Replace the success toast with: `Created N · Merged M · Skipped K duplicates`. If `created + merged === 0`, show `All K addresses already existed — nothing to import.`
- Show the same three numbers in the post-import results card.

**Activity log (optional, tiny):** when `merged > 0`, write a `lead_activities` entry per merged lead with `type='note'` and a body like `"Enriched from import: +1 phone, +1 email"`. Skip if it adds too much noise — confirm before wiring this in.

## Out of scope

- Fuzzy address matching (e.g. "123 Main St" vs "123 Main Street"). Current exact-match (case-insensitive, trimmed) stays. We can layer normalization later.
- Updating non-contact lead fields (owner, sqft, year_built) from the new file. Existing values win.
- Cross-company dedupe. Scope is per company only, as today.
