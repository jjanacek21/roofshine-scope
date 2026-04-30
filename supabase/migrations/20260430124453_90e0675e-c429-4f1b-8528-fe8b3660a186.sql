-- Assemblies = groupings of line items that the AI pulls in based on detected roof type and features.

alter table public.master_macros
  add column if not exists kind        text    not null default 'assembly',
  add column if not exists asset_type  text,
  add column if not exists is_addon    boolean not null default false;

create index if not exists master_macros_asset_type_idx
  on public.master_macros(asset_type)
  where asset_type is not null;

alter table public.master_macro_items
  add column if not exists qty_mode    text    not null default 'manual',
  add column if not exists is_optional boolean not null default false,
  add column if not exists item_notes  text;

-- Constrain qty_mode to known values
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'master_macro_items_qty_mode_chk'
  ) then
    alter table public.master_macro_items
      add constraint master_macro_items_qty_mode_chk
      check (qty_mode in ('manual', 'count', 'fixed'));
  end if;
end $$;

-- Track uploaded PDFs and their parsed color groups
create table if not exists public.assembly_imports (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid,
  uploaded_by  uuid,
  source_path  text,                                       -- storage path inside xactimate-uploads
  filename     text,
  status       text not null default 'parsed',             -- parsed | reviewing | applied | failed
  parsed       jsonb not null default '{}'::jsonb,         -- { colors: [{ hex, label, items: [...] }] }
  applied_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists assembly_imports_company_idx on public.assembly_imports(company_id);

alter table public.assembly_imports enable row level security;

drop policy if exists "Super admins manage assembly imports" on public.assembly_imports;
create policy "Super admins manage assembly imports"
  on public.assembly_imports
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "Company admins read their imports" on public.assembly_imports;
create policy "Company admins read their imports"
  on public.assembly_imports
  for select
  to authenticated
  using (company_id = public.auth_company_id() and public.is_company_admin());

drop policy if exists "Company admins insert their imports" on public.assembly_imports;
create policy "Company admins insert their imports"
  on public.assembly_imports
  for insert
  to authenticated
  with check (company_id = public.auth_company_id() and public.is_company_admin());

drop policy if exists "Company admins update their imports" on public.assembly_imports;
create policy "Company admins update their imports"
  on public.assembly_imports
  for update
  to authenticated
  using (company_id = public.auth_company_id() and public.is_company_admin());

-- Updated_at trigger
drop trigger if exists assembly_imports_set_updated_at on public.assembly_imports;
create trigger assembly_imports_set_updated_at
  before update on public.assembly_imports
  for each row execute function public.update_updated_at_column();
