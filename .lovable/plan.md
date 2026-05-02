I found two likely causes for what you’re seeing:

1. The server import is doing slow work one lead at a time, including geocoding, so the batch request can stop partway through. The database currently shows 291 leads for your company, not the full 1,264.
2. The map/list only uses the `leads` table, while contact details live in related contact/phone/email tables. Some contact info is in the database, but the import should preserve it more reliably and the UI should make progress/errors clearer.

Plan to fix it:

1. Make the import backend fast and reliable
   - Remove synchronous geocoding from the bulk import path so importing is not blocked by Google Maps calls.
   - Insert lead rows in bulk instead of one lead at a time.
   - Insert contacts, phones, and emails in bulk after the leads are created.
   - Return accurate counts: attempted, inserted leads, inserted contacts, phones, emails, and errors.

2. Preserve all CSV information
   - Keep all current property fields: street/address, city, state, zip, property type, year built, square feet, owner/reported owner, sale amount.
   - Preserve all three contact columns from the uploaded file, including contact name, title, company, phones, and emails.
   - Normalize phone/email pipe-separated values without dropping valid entries.

3. Avoid partial imports and duplicates
   - Add a lightweight dedupe strategy inside the import so retrying the same CSV does not create duplicates.
   - For rows already imported, update/fill missing property fields where possible and still attach missing contact info if needed.
   - Keep row-level security intact and continue importing only into the signed-in user’s company.

4. Improve the import screen feedback
   - Show progress by batch, e.g. “Imported 300 / 1264”.
   - Show a final detailed success message instead of only “No leads imported”.
   - Keep the uploaded file loaded after a failed or partial import so you can retry without uploading again.
   - Surface backend errors in the UI instead of hiding them in the console.

5. Backfill the current uploaded CSV
   - After the code fix is approved, I’ll use the uploaded `reonomy-leads-merged.csv` to complete the import for the remaining rows into your company.
   - I’ll verify the final database counts against the CSV: 1,264 leads, plus related contacts/phones/emails.

No visual design changes are needed; this is mainly an import reliability and data preservation fix.