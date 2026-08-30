-- The permit expediter, moved out of the .network app and into the job flow.
--
-- Four reference tables hold what the counties publish, and they are the same
-- shape they had in the project this data came from so the rows copied across
-- unchanged: 33 building departments, their published document checklists, the
-- fillable application templates with their field maps, and 2,561 product
-- approvals. Reference data is readable by any signed-in user and writable only
-- by a platform admin — the county publishes it, not the contractor.
--
-- Product approval PDFs are NOT stored here. They already sit in a public
-- bucket and are referenced by URL; moving ~1,900 files would buy nothing.

create table if not exists public.permit_building_departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  jurisdiction_type text,
  county text,
  city text,
  address text,
  phone text,
  email text,
  fax text,
  website text,
  portal_url text,
  hours text,
  zip_codes text[],
  is_hvhz boolean not null default false,
  submission_method text,
  processing_time text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pbd_county on public.permit_building_departments (county, city);

create table if not exists public.permit_required_documents (
  id uuid primary key default gen_random_uuid(),
  building_dept_id uuid not null references public.permit_building_departments(id) on delete cascade,
  trade_type text not null default 'roofing',
  document_name text not null,
  document_url text,
  is_required boolean not null default true,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_prd_dept
  on public.permit_required_documents (building_dept_id, trade_type, sort_order);

create table if not exists public.permit_form_templates (
  id uuid primary key default gen_random_uuid(),
  building_dept_id uuid references public.permit_building_departments(id) on delete set null,
  jurisdiction_name text,
  county text,
  city text,
  form_type text not null,
  form_name text not null,
  form_version text,
  trade_types text[],
  -- Storage path in the form library, or an http URL.
  file_path text not null,
  -- How to fill it: {version, text:{pdfField->sourceKey}, checks:{pdfField->flag},
  -- overflow:{pdfField->{into,chars}}}. Empty until the map has been verified
  -- against a rendered fill, because a mis-mapped field is worse than a blank.
  field_mapping jsonb not null default '{}'::jsonb,
  -- A scanned form has no AcroForm fields; it gets stamped by coordinate instead.
  fill_method text not null default 'acroform'
    check (fill_method in ('acroform','stamp','manual')),
  is_fillable boolean not null default false,
  field_count int,
  requires_signature boolean not null default false,
  requires_notary boolean not null default false,
  notary_threshold numeric,
  page_count int,
  hvhz_only boolean not null default false,
  instructions text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pft_lookup
  on public.permit_form_templates (form_type, county, building_dept_id);

create table if not exists public.product_approvals (
  id uuid primary key default gen_random_uuid(),
  manufacturer text,
  product_name text,
  product_line text,
  product_category text,
  noa_number text,
  fl_product_approval text,
  approval_date date,
  expiration_date date,
  hvhz_approved boolean not null default false,
  applicable_trades text[],
  wind_speed_rating int,
  noa_pdf_url text,
  fl_approval_pdf_url text,
  file_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pa_number on public.product_approvals (noa_number);
create index if not exists idx_pa_fl on public.product_approvals (fl_product_approval);
create index if not exists idx_pa_search
  on public.product_approvals (manufacturer, product_category) where is_active;

alter table public.permit_building_departments enable row level security;
alter table public.permit_required_documents  enable row level security;
alter table public.permit_form_templates      enable row level security;
alter table public.product_approvals          enable row level security;

do $$
declare t text;
begin
  foreach t in array array['permit_building_departments','permit_required_documents',
                           'permit_form_templates','product_approvals'] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists %I_admin on public.%I', t, t);
    execute format($f$create policy %I_admin on public.%I for all to authenticated
                      using (public.has_role(auth.uid(),'super_admin'))
                      with check (public.has_role(auth.uid(),'super_admin'))$f$, t, t);
  end loop;
end $$;

-- ============================================================
-- Job-scoped tables.
--
-- The permit record stores ONLY what the county forms need and the job does not
-- already know. Owner name, property address, city and roof area are read live
-- from jobs / clients / properties / roof_measurements at fill time, so a permit
-- can never drift from the job it belongs to. Folio, legal description and job
-- valuation have no home in the job today, so they live here.
-- ============================================================

create table if not exists public.job_permits (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  building_dept_id uuid references public.permit_building_departments(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft','assembling','ready_to_submit','submitted','issued','rejected')),
  folio_number text,
  legal_description text,
  valuation numeric,
  work_type text,
  permit_number text,
  owner_name text,
  owner_phone text,
  owner_email text,
  owner_address text,
  owner_city text,
  owner_state text,
  owner_zip text,
  lender_name text,
  lender_address text,
  surety_name text,
  bond_amount numeric,
  submitted_at timestamptz,
  issued_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_job_permits_company on public.job_permits (company_id, status);

-- The product approvals this job is built on. A join rather than a jsonb list,
-- because the packet has to open each approval's PDF and a dangling id would
-- show up as a missing page at the counter.
create table if not exists public.job_permit_products (
  id uuid primary key default gen_random_uuid(),
  permit_id uuid not null references public.job_permits(id) on delete cascade,
  product_approval_id uuid not null references public.product_approvals(id) on delete restrict,
  role text not null default 'accessory'
    check (role in ('roof_covering','underlayment','fastener','adhesive','accessory','other')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (permit_id, product_approval_id)
);

-- Files that exist only for this one permit. NOAs are not here (they come from
-- job_permit_products) and neither are licence or insurance (company_credentials).
create table if not exists public.job_permit_documents (
  id uuid primary key default gen_random_uuid(),
  permit_id uuid not null references public.job_permits(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  doc_key text not null,
  title text,
  origin text not null default 'uploaded'
    check (origin in ('generated','uploaded','pulled')),
  bucket text not null default 'job-documents',
  storage_path text not null,
  file_name text,
  mime_type text,
  file_size bigint,
  status text not null default 'provided'
    check (status in ('draft','needs_signature','needs_recording','provided','rejected')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_jpd_permit on public.job_permit_documents (permit_id, doc_key);

-- Company credentials. company_documents already exists but is a flat
-- admin-only file list with no expiry, so an expired certificate of insurance
-- would go into a packet silently. This is the table a contractor manages
-- themselves, and every credential carries the date it stops being true.
create table if not exists public.company_credentials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null check (kind in (
    'qualifier_license','general_liability','workers_comp','workers_comp_exemption',
    'business_tax_receipt','w9','surety_bond','other')),
  label text,
  holder_name text,
  number text,
  issuer text,
  issued_on date,
  expires_on date,
  bucket text not null default 'company-assets',
  storage_path text,
  file_name text,
  mime_type text,
  file_size bigint,
  is_primary boolean not null default true,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_cc_company on public.company_credentials (company_id, kind);
-- At most one primary per kind per company, enforced by the database rather
-- than a trigger so the second one is simply refused.
create unique index if not exists uq_cc_primary
  on public.company_credentials (company_id, kind) where is_primary;

alter table public.job_permits          enable row level security;
alter table public.job_permit_products  enable row level security;
alter table public.job_permit_documents enable row level security;
alter table public.company_credentials  enable row level security;

drop policy if exists job_permits_own on public.job_permits;
create policy job_permits_own on public.job_permits for all to authenticated
  using (company_id = public.auth_company_id())
  with check (company_id = public.auth_company_id());

drop policy if exists jpp_own on public.job_permit_products;
create policy jpp_own on public.job_permit_products for all to authenticated
  using (exists (select 1 from public.job_permits p
                 where p.id = permit_id and p.company_id = public.auth_company_id()))
  with check (exists (select 1 from public.job_permits p
                 where p.id = permit_id and p.company_id = public.auth_company_id()));

drop policy if exists jpd_own on public.job_permit_documents;
create policy jpd_own on public.job_permit_documents for all to authenticated
  using (company_id = public.auth_company_id())
  with check (company_id = public.auth_company_id());

-- Anyone in the company can read credentials, because the packet needs them;
-- only a company admin can change them.
drop policy if exists cc_read on public.company_credentials;
create policy cc_read on public.company_credentials for select to authenticated
  using (company_id = public.auth_company_id());
drop policy if exists cc_write on public.company_credentials;
create policy cc_write on public.company_credentials for all to authenticated
  using (company_id = public.auth_company_id() and public.is_company_admin())
  with check (company_id = public.auth_company_id() and public.is_company_admin());
