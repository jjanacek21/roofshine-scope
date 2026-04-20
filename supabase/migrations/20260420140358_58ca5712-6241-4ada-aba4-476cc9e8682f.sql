create table public.job_property_analyses (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  company_id uuid not null,
  analysis jsonb not null default '{}'::jsonb,
  photo_count int not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid
);

create index job_property_analyses_job_idx
  on public.job_property_analyses (job_id, created_at desc);

alter table public.job_property_analyses enable row level security;

create policy "Company members view property analyses"
  on public.job_property_analyses
  for select
  to authenticated
  using ((company_id = auth_company_id()) or is_super_admin());

create policy "Company members insert property analyses"
  on public.job_property_analyses
  for insert
  to authenticated
  with check (company_id = auth_company_id());

create policy "Company members update property analyses"
  on public.job_property_analyses
  for update
  to authenticated
  using ((company_id = auth_company_id()) or is_super_admin());

create policy "Company members delete property analyses"
  on public.job_property_analyses
  for delete
  to authenticated
  using ((company_id = auth_company_id()) or is_super_admin());