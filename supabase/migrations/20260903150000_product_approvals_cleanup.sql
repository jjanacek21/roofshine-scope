-- Cleaning up the product approval library.
--
-- 2,561 approvals came in from several scrapes and the keys never got
-- normalised, which quietly broke matching in three ways:
--
--   402 rows stored the NOA with its own label baked in -- "NOA No.: 22-1221.04"
--   -- so a search for 22-1221.04 missed them and the same approval appeared
--   twice under two keys that looked different.
--
--   43 rows lost the dot: 22-122104 instead of 22-1221.04. Same approval again,
--   third spelling.
--
--   22 rows had a FLORIDA PRODUCT APPROVAL number sitting in the NOA column.
--   Those are two different registries -- inside the HVHZ a counter wants a
--   Miami-Dade NOA, outside it a FL number -- and the app filters on the FL
--   column, so these were invisible where they counted. Among them were GAF
--   FeltBuster, GAF Timberline UHDZ, IKO Cambridge, Atlas Pinnacle Pristine,
--   CertainTeed Landmark, CertainTeed DiamondDeck and Owens Corning Duration:
--   the exact shingle and underlayment products the coverage audit reported as
--   missing. They were never missing, only filed wrong.
--
-- Take a snapshot before running this. The deletes are not reversible:
--   create table zz_product_approvals_backup as select * from product_approvals;

-- 1. Strip the "NOA" prefix in all its spellings.
update public.product_approvals
set noa_number = trim(regexp_replace(noa_number, '^\s*NOA\s*(No\.?)?\s*[:.\-]?\s*', '', 'i'))
where noa_number ~* '^\s*NOA';

-- 2. Put the decimal point back. A Miami-Dade NOA is NN-NNNN.NN.
update public.product_approvals
set noa_number = regexp_replace(noa_number, '^(\d{2}-\d{4})(\d{2})$', '\1.\2')
where noa_number ~ '^\d{2}-\d{6}$';

-- 3. Move Florida numbers to the column the app actually reads.
update public.product_approvals
set fl_product_approval = coalesce(fl_product_approval, replace(noa_number, 'FL-', 'FL')),
    noa_number = null
where noa_number ~* '^FL';

-- 4. Eleven rows arrived with the revision suffix as the product name ("-R27").
--    That is not a name and it scores as noise in the suggestion matcher. Null
--    is honest -- the approval number still finds the row.
update public.product_approvals
set product_name = null
where product_name ~ '^-R\d+$';

-- 5. Merge the twins the normalisation exposed.
--    Order matters: a row carrying an approval PDF beats one without, because a
--    packet needs the document and not just the number. Then the later expiry,
--    then whichever row still has a product name, then the newest.
--    An approval already attached to somebody's permit is never deleted.
with ranked as (
  select id,
    row_number() over (
      partition by noa_number
      order by (coalesce(noa_pdf_url, fl_approval_pdf_url, file_url) is not null) desc,
               expiration_date desc nulls last,
               (product_name is not null) desc,
               updated_at desc nulls last,
               id
    ) rn
  from public.product_approvals
  where noa_number is not null
)
delete from public.product_approvals p
using ranked r
where p.id = r.id
  and r.rn > 1
  and not exists (
    select 1 from public.job_permit_products jpp where jpp.product_approval_id = p.id
  );

-- 6. Stop it coming back. Two rows for one NOA means two copies of the same
--    document in front of a plans examiner.
create unique index if not exists uq_product_approvals_noa
  on public.product_approvals (noa_number)
  where noa_number is not null;
