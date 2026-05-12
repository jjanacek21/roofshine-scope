## Order Form: Versions, Approval, and $/SQ Pricing

Three tightly related additions to the existing **Order Form** tab on the job workflow.

---

### 1. Real cost inputs + $/SQ math

Today the snapshot only captures materials + labor + markup. We add the missing job-level costs so the customer price is realistic and we can derive a true per-square price.

New fields on the **Build Order** tab (saved on `job_order_drafts`):
- **Dump fees** (`dump_cost`)
- **Permit fees** (`permit_cost`)
- **Other costs** (`extra_costs` — list of `{label, amount}`, e.g. crane, dumpster pickup)

New totals shown in the totals card and on every print view:
```
Job Cost   = Materials + Labor + Dump + Permits + Extras
Markup     = Job Cost × markup_pct
Customer $ = Job Cost + Markup
Profit     = Customer $ − Job Cost
$ / SQ     = Customer $ ÷ Squares    (uses the `sq` measurement input)
Cost / SQ  = Job Cost   ÷ Squares
```

`$ / SQ` only renders when `sq > 0`; otherwise shows "—".

---

### 2. Snapshot version history + rollback

Snapshots already exist; we make them a real version log.

New columns on `job_order_snapshots`:
- `version_number` (auto-increment per job)
- `status` enum: `draft` (default on save), `pending_approval`, `approved`, `superseded`, `rejected`
- `approved_by`, `approved_at`, `approval_notes`
- `dump_cost`, `permit_cost`, `extra_costs jsonb`
- `per_sq_price`, `cost_per_sq`, `total_squares` (snapshotted at save time)
- `created_by`

New **Versions** sub-tab in the Order Form (sits next to Build Order / Pre-Cap / Crew / Supplier):
- Table of all snapshots: `v#`, date, who saved, template, **Customer $**, **$/SQ**, **Profit %**, status badge.
- Row actions per snapshot:
  - **View** — opens read-only side panel of materials/labor/totals.
  - **Compare** — pick any two snapshots; renders a side-by-side diff (qty, unit price, line total, $/SQ delta), with green/red deltas per line.
  - **Rollback** — copies that snapshot's `inputs`, `material_overrides`, `labor_overrides`, dump/permit/extras, markup, and tax back into the live draft. Confirms first; creates a new "Rolled back from v#" entry in a small `job_order_history` audit row so we don't lose what was overwritten.
  - **Submit for approval** (only on `draft`, only if you saved it).
  - **Delete** (only on your own `draft` snapshots).

---

### 3. Approval workflow

Snapshots become the gate between "internal working numbers" and "what the crew/supplier can see".

Rules:
- Anyone on the company can `Save Snapshot` → creates `status='draft'`.
- Author clicks **Submit for approval** → `status='pending_approval'`.
- A user with `is_company_admin()` sees pending versions in the Versions tab with **Approve** / **Reject** buttons (with optional note).
- On approve: any prior `approved` snapshot for the same job flips to `superseded`; the new one becomes `approved` with `approved_by`, `approved_at`.
- The **Pre-Cap**, **Crew Work Order**, and **Supplier Order** print views switch their data source:
  - If a job has an `approved` snapshot → render from that snapshot, with an "APPROVED v# • {date} • {approver}" stamp in the header.
  - If none → show a clear empty state ("No approved order yet — ask an admin to approve a snapshot before sharing with crew/supplier.") Print is disabled.
- The **Build Order** tab keeps showing the live draft (so estimators can keep iterating).

RLS: snapshots stay scoped by `company_id = auth_company_id()`. Approve/reject uses a security-definer RPC `approve_order_snapshot(_id, _note)` / `reject_order_snapshot(_id, _note)` that checks `is_company_admin()`.

---

### Technical details

**Migration**
- Alter `job_order_drafts`: add `dump_cost numeric default 0`, `permit_cost numeric default 0`, `extra_costs jsonb default '[]'`.
- Alter `job_order_snapshots`: add the columns listed above; backfill `version_number` per job; default new `status='draft'`.
- Create enum `order_snapshot_status`.
- Trigger on insert: assign next `version_number` for `(company_id, job_id)`.
- Functions: `submit_order_snapshot(_id)`, `approve_order_snapshot(_id, _note)`, `reject_order_snapshot(_id, _note)`, `rollback_order_snapshot(_id)` (copies snapshot back into the draft for that job, returns the new draft id).
- Optional `job_order_history` table: `{snapshot_id, action, actor, payload, created_at}` for audit.

**Hooks (new in `src/hooks/useOrderForm.ts`)**
- `useJobOrderSnapshots(jobId)` — list, ordered desc by `version_number`.
- `useApprovedOrderSnapshot(jobId)` — single `approved` row (used by print views).
- Mutations: `submit`, `approve`, `reject`, `rollback`, `deleteSnapshot`.

**Calc helper (`src/lib/order-form-calc.ts`)**
- Extend `totals` to include `dump`, `permits`, `extras`, `perSq`, `costPerSq`.
- New `diffSnapshots(a, b)` that returns per-line deltas + totals delta.

**UI files**
- `src/routes/_app.jobs.$id.order-form.tsx` — add `versions` sub-tab, gate print views on approved snapshot, surface dump/permit/extras inputs, show $/SQ.
- New `src/components/order-form/VersionsTab.tsx` — table + actions.
- New `src/components/order-form/SnapshotDiff.tsx` — comparison view.
- New `src/components/order-form/SnapshotViewer.tsx` — read-only viewer used by View, Pre-Cap (when reading approved), Crew, Supplier.
- New `src/components/order-form/ApprovalBadge.tsx` — status pill + approver stamp for headers.

**Out of scope (call out so we don't scope-creep)**
- E-signing or external customer approval. Approval is internal only.
- Auto-syncing the contract/estimate when a snapshot is approved (we keep them independent for now).
- Exporting snapshots as standalone PDFs (still uses `window.print()`).

---

### Build order
1. Migration + RPCs + enum + trigger.
2. Hook layer + calc updates.
3. Build Order: dump/permit/extras inputs + $/SQ display.
4. Versions sub-tab (list, view, rollback, submit, approve, reject, delete).
5. Snapshot diff view.
6. Gate Pre-Cap / Crew / Supplier print views on approved snapshot, render approval stamp.
