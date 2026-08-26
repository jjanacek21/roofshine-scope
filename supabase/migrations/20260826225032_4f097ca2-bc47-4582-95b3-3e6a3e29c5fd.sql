-- 1. Schema
create table public.platform_features (
  key         text primary key,
  parent_key  text references public.platform_features(key) on delete cascade,
  label       text not null,
  description text,
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  released_at timestamptz not null default now()
);

create table public.company_features (
  company_id  uuid not null references public.companies(id) on delete cascade,
  feature_key text not null references public.platform_features(key) on delete cascade,
  enabled     boolean not null default false,
  config      jsonb   not null default '{}'::jsonb,
  granted_by  uuid,
  granted_at  timestamptz not null default now(),
  primary key (company_id, feature_key)
);

create table public.feature_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.feature_preset_items (
  preset_id   uuid not null references public.feature_presets(id) on delete cascade,
  feature_key text not null references public.platform_features(key) on delete cascade,
  primary key (preset_id, feature_key)
);

grant select on public.platform_features to authenticated;
grant select, insert, update, delete on public.platform_features to service_role;
grant select on public.company_features to authenticated;
grant all on public.company_features to service_role;
grant select on public.feature_presets to authenticated;
grant all on public.feature_presets to service_role;
grant select on public.feature_preset_items to authenticated;
grant all on public.feature_preset_items to service_role;

-- 2. Registry seed
insert into public.platform_features (key, parent_key, label, sort_order) values
  ('crm', null, 'CRM', 100),
  ('crm.dashboard', 'crm', 'Dashboard', 101),
  ('crm.clients', 'crm', 'Clients', 102),
  ('crm.jobs', 'crm', 'Jobs', 103),
  ('jobs', null, 'Job Workflow', 200),
  ('jobs.measure', 'jobs', 'Measurements', 201),
  ('jobs.photos', 'jobs', 'Photos', 202),
  ('jobs.estimate', 'jobs', 'Estimate', 203),
  ('jobs.order_form', 'jobs', 'Order Form', 204),
  ('jobs.contract', 'jobs', 'Contract', 205),
  ('jobs.invoices', 'jobs', 'Invoices', 206),
  ('jobs.report', 'jobs', 'Report', 207),
  ('jobs.documents', 'jobs', 'Documents', 208),
  ('commercial', null, 'Commercial Roofing', 300),
  ('commercial.dashboard', 'commercial', 'Dashboard', 301),
  ('commercial.leads', 'commercial', 'Leads', 302),
  ('commercial.calculator', 'commercial', 'Calculator', 303),
  ('commercial.prospecting', 'commercial', 'Prospecting', 304),
  ('commercial.customers', 'commercial', 'Customers', 305),
  ('commercial.tickets', 'commercial', 'Work Orders', 306),
  ('commercial.pipeline', 'commercial', 'Pipeline', 307),
  ('commercial.map', 'commercial', 'Map', 308),
  ('commercial.forms', 'commercial', 'Form Builder', 309),
  ('commercial.export', 'commercial', 'Export / CRM', 310),
  ('admin_portal', null, 'Company Admin Portal', 400),
  ('admin_portal.branding', 'admin_portal', 'Branding', 401),
  ('admin_portal.pricing', 'admin_portal', 'Pricing', 402),
  ('admin_portal.suppliers', 'admin_portal', 'Suppliers', 403),
  ('admin_portal.calculator', 'admin_portal', 'Calculator config', 404),
  ('admin_portal.contracts', 'admin_portal', 'Contracts', 405),
  ('admin_portal.reports', 'admin_portal', 'Reports', 406),
  ('admin_portal.team', 'admin_portal', 'Team', 407),
  ('door_to_door', null, 'Door to Door', 500),
  ('storm_intel', null, 'Storm Intel', 600),
  ('claim_buddy', null, 'Claim Buddy', 700),
  ('my_card', null, 'My Card', 800),
  ('survival_guide', null, 'Survival Guide', 900);

-- 3. Backfill grants (reproduces today's behavior exactly)
insert into public.company_features (company_id, feature_key, enabled)
select c.id, f.key, true
from public.companies c
cross join (
  select unnest(array[
    'crm','crm.dashboard','crm.clients','crm.jobs',
    'jobs','jobs.measure','jobs.photos','jobs.estimate','jobs.order_form',
    'jobs.contract','jobs.invoices','jobs.report','jobs.documents',
    'my_card','survival_guide','claim_buddy'
  ]) as key
) f
on conflict do nothing;

insert into public.company_features (company_id, feature_key, enabled)
select c.id, f.key, true
from public.companies c
cross join (
  select unnest(array[
    'commercial','commercial.dashboard','commercial.leads','commercial.calculator',
    'commercial.prospecting','commercial.customers','commercial.tickets',
    'commercial.pipeline','commercial.map','commercial.forms','commercial.export'
  ]) as key
) f
where coalesce(c.is_roof_king, false) or coalesce(c.feature_roof_king, false)
on conflict do nothing;

insert into public.company_features (company_id, feature_key, enabled)
select c.id, 'door_to_door', true from public.companies c
where coalesce(c.feature_door_to_door, false)
on conflict do nothing;

insert into public.company_features (company_id, feature_key, enabled)
select c.id, 'storm_intel', true from public.companies c
where coalesce(c.feature_storm_intel, false)
on conflict do nothing;

-- 4. Resolution + RLS
create or replace function public.company_has_feature(p_company_id uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_features pf
    join public.company_features cf
      on cf.feature_key = pf.key and cf.company_id = p_company_id
    where pf.key = p_key
      and pf.is_active
      and cf.enabled
      and (
        pf.parent_key is null
        or exists (
          select 1 from public.company_features pcf
          join public.platform_features ppf on ppf.key = pcf.feature_key
          where pcf.company_id = p_company_id
            and pcf.feature_key = pf.parent_key
            and pcf.enabled
            and ppf.is_active
        )
      )
  );
$$;

alter table public.platform_features enable row level security;
alter table public.company_features enable row level security;
alter table public.feature_presets enable row level security;
alter table public.feature_preset_items enable row level security;

create policy "platform_features readable by authenticated"
  on public.platform_features for select to authenticated using (true);
create policy "platform_features writable by super admin"
  on public.platform_features for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy "company_features readable by own company"
  on public.company_features for select to authenticated
  using (company_id = public.auth_company_id() or public.is_super_admin());
create policy "company_features writable by super admin"
  on public.company_features for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy "feature_presets super admin only"
  on public.feature_presets for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy "feature_preset_items super admin only"
  on public.feature_preset_items for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- 5. RPC
create or replace function public.company_my_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_role text;
  v_super boolean;
  v_features jsonb;
begin
  select p.company_id, p.role::text into v_company, v_role
  from public.profiles p where p.id = auth.uid();

  v_super := coalesce(v_role = 'super_admin', false);

  select coalesce(jsonb_object_agg(pf.key, val), '{}'::jsonb) into v_features
  from public.platform_features pf
  cross join lateral (
    select case
      when v_super then true
      when v_company is null then false
      else public.company_has_feature(v_company, pf.key)
    end as val
  ) r
  where pf.is_active;

  return jsonb_build_object(
    'company_id', v_company,
    'role', v_role,
    'is_super_admin', v_super,
    'features', v_features
  );
end;
$$;

grant execute on function public.company_has_feature(uuid, text) to authenticated, service_role;
grant execute on function public.company_my_context() to authenticated, service_role;