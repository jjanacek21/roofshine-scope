-- Attaching product approvals to a permit packet.
--
-- The Permits tab claimed approvals were "attached automatically" and told the
-- user to pick products on the Order Form. Neither was true: nothing in the app
-- had ever written a job_permit_products row, and the material catalogue has no
-- key into the approval library at all. The picker that fixes that suggests an
-- approval per material by name and lets the user confirm each one.
--
-- Attaching the same approval twice would put the same NOA in the packet twice,
-- so one row per approval per permit; the helper treats the resulting 23505 as
-- success, because the approval is on the packet either way.
create unique index if not exists uq_job_permit_products
  on public.job_permit_products (permit_id, product_approval_id);
