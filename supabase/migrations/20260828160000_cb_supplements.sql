-- One row per carrier estimate uploaded against a Claim Buddy job.
--
-- The parsed carrier lines and the gap list are jsonb rather than their own
-- tables: both are a snapshot of one PDF at one moment, never queried across
-- jobs, and re-parsing replaces them wholesale. Same shape cb_reports already
-- uses for line_items and narrative.
create table if not exists public.cb_supplements (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.cb_jobs(id) on delete cascade,
  pdf_path text,
  file_name text,
  status text not null default 'uploaded'
    check (status in ('uploaded','parsing','parsed','failed')),
  parse_error text,
  carrier text,
  claim_number text,
  carrier_total numeric,
  -- [{code,name,unit,qty,unit_price,total}] exactly as printed on their estimate
  lines jsonb not null default '[]'::jsonb,
  -- Xactimate's own measurements off their sketch page. More accurate than
  -- ours when present, so they win on quantity.
  carrier_measure jsonb not null default '{}'::jsonb,
  -- what the inspection photos support, kept so a re-open does not re-bill vision
  photo_findings jsonb not null default '[]'::jsonb,
  -- [{id,label,unit,qty,backing,kind,carrierQty,carrierName}] derived from our own numbers
  gaps jsonb not null default '[]'::jsonb,
  -- gap ids the rep has already pushed into the estimate
  applied jsonb not null default '[]'::jsonb,
  carrier_imported_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cb_supplements_job
  on public.cb_supplements (job_id, created_at desc);

alter table public.cb_supplements enable row level security;

drop policy if exists cb_sup_all on public.cb_supplements;
create policy cb_sup_all on public.cb_supplements for all to authenticated
  using (public.cb_can_access_job(job_id))
  with check (public.cb_can_access_job(job_id));

drop trigger if exists cb_supplements_touch on public.cb_supplements;
create trigger cb_supplements_touch before update on public.cb_supplements
  for each row execute function public.cb_touch_updated_at();
