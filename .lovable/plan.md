## Goal

A single **Documents** tab on each job that shows every file related to that job in one list, supports free-form uploads, and surfaces auto-generated PDFs (measurements, work orders, contracts/contingencies, completed reports) as soon as they're created.

## Why your signed contract isn't showing

I checked the database: the `contracts` table has **0 rows** and the `contracts` storage bucket has **0 objects**. Nothing was actually saved yesterday. Today the flow is:

1. Sign in the iframe → PDF downloads to your device.
2. You must then tap **Save signed PDF**, pick the freshly-downloaded file in the upload dialog, and tap **Upload**.

If step 2 was skipped (or the upload errored and the toast was missed), nothing lands in the bucket or table. The Documents tab will make this much harder to miss (clear empty state + one upload button that handles any file type).

## Plan

### 1. New "Documents" job tab

- Add `Documents` to `src/components/jobs/JobTabs.tsx` (between Contract and Report).
- New route: `src/routes/_app.jobs.$id.documents.tsx` rendering a new `JobDocumentsPanel`.

### 2. `job_documents` table + storage

- New table `public.job_documents`:
  - `job_id`, `company_id`, `kind` (enum: `measurement_report`, `work_order`, `contract`, `contingency`, `completed_report`, `upload`), `title`, `bucket`, `storage_path`, `mime_type`, `file_size`, `source_id` (nullable FK-ish reference to the originating row), `created_by`, `created_at`.
  - RLS scoped by `auth_company_id()`.
- New private bucket `job-documents` for user uploads (path: `{company_id}/{job_id}/{uuid}-{filename}`).
- Existing PDFs stay in their current buckets (`generated-pdfs`, `contracts`, `roof-reports`). The Documents tab queries `job_documents` **plus** existing tables (`generated_reports`, `contracts`, future work-order snapshots) and unions them for display, so we don't have to migrate old files.

### 3. UI: `JobDocumentsPanel`

- Grouped list with sections: Measurement Reports, Work Orders, Contracts & Contingencies, Completed Reports, Uploads.
- Each row: icon + title + kind badge + date + size + actions (View, Download, Delete).
- Sticky **Upload** button → file picker (any type, 25 MB cap) → uploads to `job-documents` bucket → inserts into `job_documents` with `kind='upload'`.
- Empty state per section.
- Signed URLs (1h) for private buckets; direct public URL for `contracts`.

### 4. Auto-link generated PDFs

When the app generates a PDF, also insert a `job_documents` row so it appears in the tab automatically:

- **Measurement report PDF**: when measurement report is generated/saved → insert with `kind='measurement_report'`.
- **Work Order / Order-form snapshot**: when an order snapshot is approved/exported to PDF → insert with `kind='work_order'`.
- **Contract / Contingency**: extend `UploadSignedContractDialog` mutation to also insert into `job_documents` (`kind` = `contract` or `contingency`) on success. Also add a row for any future contract created.
- **Completed report**: `src/lib/pdf-generator.ts` already inserts into `generated_reports`; add a parallel `job_documents` insert (`kind='completed_report'`) using the same `pdf_path`/bucket.

### 5. Fix the contract upload reliability gap

- Add a toast + persistent error message if the storage upload or DB insert fails inside `UploadSignedContractDialog` (already partially there — make the error block sticky and prevent dialog close while pending).
- After successful upload, refetch `job-contracts` **and** `job-documents` queries.
- Add a small "Recent downloads" hint in the dialog explaining the file is in your phone's Downloads folder.

### 6. Out of scope (ask before doing)

- Migrating any historical files (none exist).
- Folder/tagging system beyond the fixed kinds.
- In-app PDF viewer (we'll open in a new tab).

## Technical notes

- One SQL migration: `job_documents` table + RLS + `job-documents` bucket + bucket policies.
- New file: `src/components/jobs/JobDocumentsPanel.tsx`, `src/routes/_app.jobs.$id.documents.tsx`.
- Edits: `JobTabs.tsx`, `UploadSignedContractDialog.tsx`, `src/lib/pdf-generator.ts`, and wherever measurement reports + order-form PDFs are produced (I'll locate those during implementation).
- Reuses existing semantic tokens; no new design primitives.

Approve and I'll start with the migration.
