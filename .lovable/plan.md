

The upload is failing for two distinct reasons, both fixable:

**Bug 1 — Storage RLS blocks master uploads.** The wizard uploads the source file to `xactimate-uploads/master/...`, but the bucket's INSERT policy only allows paths where the first folder equals the user's `company_id`. There is no policy for super-admin master uploads, so the upload throws → the toast shows an error → no rows are written.

**Bug 2 — PDF estimates are rejected.** Standard Xactimate exports are PDFs, but `UploadParseStep` only accepts `.xlsx/.xls/.csv`. There's no PDF parser anywhere in the wizard.

The user confirmed they want to upload **both PDF and spreadsheet** Xactimate exports.

## Plan

### 1. Fix storage RLS (migration)
Add policies on `storage.objects` so super-admins can read/write/delete anywhere in `xactimate-uploads`:
```sql
CREATE POLICY "Super admins manage xactimate uploads"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'xactimate-uploads' AND public.is_super_admin())
WITH CHECK (bucket_id = 'xactimate-uploads' AND public.is_super_admin());
```

### 2. Add PDF parsing to the upload wizard

**a) New server route `src/routes/api.parse-xactimate-pdf.ts`** — accepts a PDF upload, extracts text using `pdfjs-dist` (Worker-compatible), then uses Lovable AI Gateway (`google/gemini-2.5-pro`, multimodal — handles tables and OCR'd PDF text) to extract a JSON array of line items: `{ code, description, unit, unit_price, qty?, category? }`. Returns `{ rows: [...], headers: [...] }` in the same shape `UploadParseStep` already uses, so the rest of the wizard works unchanged.

**b) Update `UploadParseStep.tsx`**:
- Accept `application/pdf` in dropzone.
- When file is a PDF: show "Extracting line items with AI…" spinner, POST to `/api/parse-xactimate-pdf`, then feed the returned rows into the same `ParsedFile` shape with auto-mapped headers (`code, name, unit, unit_price, category`). Skip the column-mapping table for PDFs (it's already mapped) — show a green "✓ AI extracted N line items" panel and jump to step 3.
- Spreadsheet path stays exactly as it is today.

**c) Surface parser failures clearly** — if the PDF has fewer than 5 rows extracted or AI returns invalid JSON, show an inline error with a "Try uploading the .xlsx export from Xactimate instead" hint.

### 3. Resilience tweaks in `admin.price-books.new.tsx`
- Wrap the storage upload in `try/catch` and continue creating the price book even if the source-file upload fails (the DB rows are what matter; just log a warning toast instead of aborting the whole flow).
- Show the actual Supabase error message in the toast (currently it just reads "Upload failed").

### Out of scope (intentional)
- Multi-file batch uploads — one file per book stays the rule.
- Editing AI-extracted rows before insert — they flow into the existing Match & Confirm screen where the user already sees them.
- Exotic Xactimate "sketch" PDFs that contain no text layer (image-only). The plan handles standard text-based PDFs; image-only PDFs would need OCR which we can add later if you hit one.

### How it works after the fix
1. Super admin → Admin → Price Books → "Upload master book"
2. Step 2: drop a `.pdf` (or `.xlsx`/`.csv`)
3. PDF → AI extracts line items in ~10–20 s, jumps to Match & Confirm
4. Spreadsheet → existing column-mapping flow
5. Confirm → rows insert into `line_item_master` (where `company_id IS NULL`) and prices into `line_item_prices` against the new master `price_books` row
6. Every company sees these as fallback pricing automatically (resolver already handles this)

