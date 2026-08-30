-- Two things that made the job flow leak.
--
-- 1. No contract had ever been saved — not on this job, in the whole app.
--    A contract belongs to a tenant, and tenant_users rows were only seeded by
--    an exact match on five @globalcontractor.network addresses, with RLS
--    letting only a super admin insert more. Everyone else, including company
--    owners, saw "Contracts not enabled" and could never reach the signing
--    flow. A tenant is really just the contract-facing face of a company, so
--    it is now provisioned from the company the caller already belongs to.
--
-- 2. Files produced for a job did not all reach its Documents tab, because
--    each producer wrote its own insert and some never did.

create or replace function public.ensure_contract_tenant()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_company public.companies%rowtype;
  v_tenant  public.tenants%rowtype;
  v_tu      public.tenant_users%rowtype;
  v_slug    text;
  v_name    text;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  -- Already provisioned. Reactivate rather than create a second row.
  select * into v_tu from public.tenant_users
   where user_id = v_user order by is_active desc, created_at limit 1;
  if found then
    if not v_tu.is_active then
      update public.tenant_users set is_active = true where id = v_tu.id returning * into v_tu;
    end if;
    select * into v_tenant from public.tenants where id = v_tu.tenant_id;
    return jsonb_build_object('ok', true, 'created', false,
      'tenant', to_jsonb(v_tenant), 'tenant_user', to_jsonb(v_tu));
  end if;

  select * into v_profile from public.profiles where id = v_user;
  if not found or v_profile.company_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_company');
  end if;
  select * into v_company from public.companies where id = v_profile.company_id;

  -- One tenant per company, so a colleague's contracts and yours land together.
  select * into v_tenant from public.tenants
   where company_id = v_company.id and is_active order by created_at limit 1;

  if not found then
    v_slug := trim(both '-' from regexp_replace(lower(coalesce(v_company.name, 'company')), '[^a-z0-9]+', '-', 'g'));
    if v_slug = '' then v_slug := 'company'; end if;
    if exists (select 1 from public.tenants where slug = v_slug) then
      v_slug := v_slug || '-' || substr(replace(v_company.id::text, '-', ''), 1, 6);
    end if;

    insert into public.tenants
      (slug, company_name, company_address, company_phone, company_email, company_web, company_id)
    values
      (v_slug, coalesce(v_company.name, 'Company'), v_company.address, v_company.phone,
       v_company.email, v_company.website, v_company.id)
    returning * into v_tenant;
  end if;

  v_name := nullif(trim(coalesce(v_profile.first_name, '') || ' ' || coalesce(v_profile.last_name, '')), '');
  v_name := coalesce(v_name, v_profile.email, 'Rep');

  insert into public.tenant_users
    (tenant_id, user_id, rep_slug, rep_name, rep_title, rep_phone, rep_email)
  values (
    v_tenant.id, v_user,
    trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g')),
    v_name, v_profile.title,
    coalesce(nullif(v_profile.mobile_phone, ''), nullif(v_profile.office_phone, '')),
    v_profile.email
  )
  on conflict (tenant_id, user_id) do update set is_active = true
  returning * into v_tu;

  return jsonb_build_object('ok', true, 'created', true,
    'tenant', to_jsonb(v_tenant), 'tenant_user', to_jsonb(v_tu));
end $$;

-- Narrow on purpose: it only ever adds the CALLER to the tenant of the
-- CALLER's own company, so security definer buys nothing an attacker wants.
revoke all on function public.ensure_contract_tenant() from public, anon;
grant execute on function public.ensure_contract_tenant() to authenticated;

-- Permit paperwork belongs in the Documents tab like everything else. A kind of
-- its own rather than 'other', so a filled application and a recorded NOC are
-- findable as what they are.
alter table public.job_documents drop constraint if exists job_documents_kind_check;
alter table public.job_documents add constraint job_documents_kind_check
  check (kind = any (array[
    'measurement_report','work_order','contract','contingency',
    'completed_report','permit','upload','other'
  ]));

-- Filing the same file twice produces a duplicate row in the Documents tab and
-- a duplicate page in a permit packet. One row per file per job; the filing
-- helper treats the resulting 23505 as success, because the file is listed.
create unique index if not exists uq_job_documents_file
  on public.job_documents (job_id, bucket, storage_path);
