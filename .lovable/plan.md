
## Goal

Fix the Pricing upload so a user can upload a Xactimate **estimate file** (PDF, CSV, XLS, XLSX), have the app **extract all line items**, and keep **Master Macros inside Pricing** instead of as a separate destination.

## What I found

The current upload flow is still built like a **price-book importer**, not an **estimate-file extractor**:

- The UI still says “book” almost everywhere.
- Spreadsheet parsing only reads the **first sheet** and assumes **row 1 is the header row**.
- It only works cleanly when it finds columns that map to **code + name + unit_price**.
- Many Xactimate estimate exports use different shapes:
  - header row is lower in the sheet
  - columns are named things like **Selector, Activity, Qty, RCV, ACV, Total**
  - some files have **total + qty**, not explicit **unit price**
- That means the file can load, but the wizard still won’t let you continue because the required mappings never resolve.

There is also still a separate **Master Macros** admin destination, which conflicts with your request to keep macros under **Pricing**.

## Plan

### 1) Rework the upload flow around “Estimate Files”, not “Books”
Update the Pricing screens and upload wizard copy so the user is clearly uploading:
- **PDF estimate**
- **CSV estimate**
- **Excel estimate**

Rename the visible labels/buttons/help text from “Upload book” / “Price book” to wording like:
- “Upload estimate file”
- “Extract line items”
- “Insurance pricing library”

Keep the existing route/table names internally for now to avoid breaking the app.

### 2) Fix spreadsheet extraction so Xactimate files actually import
Replace the current “first sheet + first row headers” logic with a more tolerant parser:

- scan multiple sheets
- inspect the first several rows of each sheet
- detect the most likely header row
- recognize Xactimate-style columns such as:
  - Selector / Code
  - Description / Activity / Item
  - Unit
  - Qty
  - Unit Price / Price
  - Total / RCV / ACV
  - Category
- if a file has **qty + total** but no unit price, derive:
  - `unit_price = total / qty`
- normalize all supported file types into the same line-item shape before the review step

This is the most likely reason the current upload still “won’t let” you proceed.

### 3) Make PDF extraction match the spreadsheet flow
Keep the PDF parser, but improve it so it behaves like the spreadsheet import path:

- treat it as an **estimate extractor**
- normalize into the same fields used by spreadsheet uploads
- return clearer errors when the PDF is image-only or the extraction is too weak
- show a better success state like “Extracted N line items from estimate”

### 4) Improve the review step for estimate documents
Update the review/confirm step so it works for extracted estimate files, not just perfect price-book tables:

- show extracted rows even when some fields were inferred
- allow rows with derived unit price
- clearly show ignored rows and why they were skipped
- make the CTA about **saving extracted line items into pricing**, not “creating a book”

### 5) Keep Master Macros under Pricing
Move macros into the Pricing experience instead of keeping them as a separate admin destination:

- **Admin Pricing**
  - Insurance pricing uploads
  - Retail pricing / Master Macros
- **Company Pricing**
  - Insurance pricing library
  - Retail pricing with macros and company overrides

Implementation-wise, I’d fold the current admin macros UI into the admin pricing page and remove the separate “Master Macros” nav item.

### 6) Clean up wording everywhere
Update wording across:
- sidebar/topbar labels if needed
- pricing page headings
- upload buttons
- empty states
- helper text
- toasts

So the app consistently says:
- **Pricing**
- **Insurance Pricing**
- **Retail Pricing**
- **Estimate File**
- **Extract Line Items**

instead of “book” language where the user is really uploading a document.

## Technical details

### Files to update
- `src/components/pricebook/UploadParseStep.tsx`
- `src/components/pricebook/MatchConfirmStep.tsx`
- `src/lib/xactimate-parser.ts`
- `src/routes/api.parse-xactimate-pdf.ts`
- `src/routes/_app.price-books.new.tsx`
- `src/routes/_app.price-books.tsx`
- `src/routes/admin.price-books.tsx`
- `src/routes/admin.price-books.new.tsx`
- `src/routes/admin.tsx`
- possibly `src/components/layout/AppSidebar.tsx` / `Topbar.tsx` for copy consistency

### Likely parser changes
Add richer column roles such as:
- `qty`
- `line_total`
- `rcv`
- `acv`

Then normalize with fallback rules:
```text
If unit_price exists -> use it
Else if qty + total/rcv exist -> derive unit_price
Else mark row ignored with reason
```

### Data model
This can likely be done **without schema changes** for the main fix.
The existing pricing tables can still store the extracted normalized line items.

## Result after implementation

A user will be able to open Pricing, upload a **PDF / CSV / Excel Xactimate estimate**, and the system will:
1. detect the correct table/header structure,
2. extract the line items,
3. normalize them,
4. show a review screen,
5. save them into the pricing library.

And Master Macros will live **inside Pricing**, not as a separate area.
