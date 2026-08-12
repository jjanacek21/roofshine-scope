alter table public.estimates
  alter column job_id drop not null,
  alter column company_id drop not null,
  add column if not exists cb_job_id uuid references public.cb_jobs(id) on delete cascade,
  add column if not exists cb_mode text,
  add column if not exists price_per_square numeric;

create index if not exists estimates_cb_job_id_idx on public.estimates (cb_job_id);

alter table public.estimates drop constraint if exists estimates_owner_present;
alter table public.estimates add constraint estimates_owner_present
  check (job_id is not null or cb_job_id is not null);

alter table public.cb_workspaces
  add column if not exists default_price_per_square numeric not null default 0;

drop policy if exists "CB members manage inspection estimates" on public.estimates;
create policy "CB members manage inspection estimates"
  on public.estimates for all to authenticated
  using (cb_job_id is not null and public.cb_can_access_job(cb_job_id))
  with check (cb_job_id is not null and public.cb_can_access_job(cb_job_id));

drop policy if exists "CB members manage inspection estimate lines" on public.estimate_line_items;
create policy "CB members manage inspection estimate lines"
  on public.estimate_line_items for all to authenticated
  using (exists (select 1 from public.estimates e
                 where e.id = estimate_line_items.estimate_id
                   and e.cb_job_id is not null
                   and public.cb_can_access_job(e.cb_job_id)))
  with check (exists (select 1 from public.estimates e
                 where e.id = estimate_line_items.estimate_id
                   and e.cb_job_id is not null
                   and public.cb_can_access_job(e.cb_job_id)));

CREATE OR REPLACE FUNCTION public.cb_convert_to_job(_job uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare   _uid uuid := auth.uid(); _gc uuid; j public.cb_jobs%rowtype;
  _client uuid; _prop uuid; _newjob uuid; _rm uuid;
  _m public.cb_measurements%rowtype; _photos int := 0; _label text;
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  if not public.cb_can_access_job(_job) then raise exception 'You do not have access to this inspection'; end if;
  _gc := public.cb_gc_company_id();
  if _gc is null then
    raise exception 'This account has Claim Buddy only. A GlobalContractor seat is required to create a job.';
  end if;
  select * into j from public.cb_jobs where id = _job;
  if j.gc_job_id is not null then
    return jsonb_build_object('gc_job_id', j.gc_job_id, 'already', true);
  end if;
  _label := coalesce(nullif(j.customer_name,''), nullif(j.address,''), 'Claim Buddy inspection');
  select id into _client from public.clients where company_id = _gc and lower(name) = lower(_label) limit 1;
  if _client is null then
    insert into public.clients (company_id, name, email, phone, address)
    values (_gc, _label, j.customer_email, j.customer_phone, j.address) returning id into _client;
  end if;
  insert into public.properties (company_id, client_id, address, city, state, zip, lat, lng, property_type)
  values (_gc, _client, coalesce(j.address,'Unknown'), j.city, j.state, j.zip, j.lat, j.lng, 'residential')
  returning id into _prop;
  insert into public.jobs (company_id, client_id, property_id, name, property_address, status,
    primary_trade, job_type, claim_number, insurance_carrier, created_by, assigned_to, roof_system, notes)
  values (_gc, _client, _prop, _label || ' - ' || coalesce(j.address,''), j.address,
    'inspected'::job_status, 'roofing'::trade_type, 'insurance', j.claim_number, j.carrier, _uid, _uid,
    (select data->'roof'->>'roof_type' from public.cb_takeoffs where job_id = _job),
    'Imported from Claim Buddy inspection ' || _job::text ||
      case when j.date_of_loss is not null then ' | Date of loss: ' || j.date_of_loss::text else '' end)
  returning id into _newjob;
  select * into _m from public.cb_measurements where job_id = _job;
  if found then
    if _m.gc_roof_measurement_id is not null then
      _rm := _m.gc_roof_measurement_id;
      update public.roof_measurements set
        property_id = _prop, company_id = _gc,
        predominant_pitch = coalesce(_m.pitch, predominant_pitch), waste_pct = _m.waste_pct,
        squares = _m.total_squares, total_area_sqft = _m.total_area_sqft,
        eaves_lf = _m.eave_lf, rakes_lf = _m.rake_lf, ridges_lf = _m.ridge_lf, hips_lf = _m.hip_lf,
        valleys_lf = _m.valley_lf, gutters_lf = _m.gutter_lf, wall_flashing_lf = _m.wall_flashing_lf,
        step_flashing_lf = _m.step_flashing_lf, updated_at = now()
      where id = _rm;
    else
      insert into public.roof_measurements (property_id, company_id, source, predominant_pitch, waste_pct,
        squares, total_area_sqft, eaves_lf, rakes_lf, ridges_lf, hips_lf, valleys_lf, gutters_lf,
        wall_flashing_lf, step_flashing_lf, created_by, ai_analysis, notes)
      values (_prop, _gc,
        case when _m.source = 'instant' then 'google_solar'::roof_measurement_source
             else 'manual'::roof_measurement_source end,
        _m.pitch, _m.waste_pct, _m.total_squares, _m.total_area_sqft, _m.eave_lf, _m.rake_lf, _m.ridge_lf,
        _m.hip_lf, _m.valley_lf, _m.gutter_lf, _m.wall_flashing_lf, _m.step_flashing_lf, _uid, _m.raw,
        'Imported from Claim Buddy') returning id into _rm;
      update public.cb_measurements set gc_roof_measurement_id = _rm where job_id = _job;
    end if;
  end if;
  insert into public.job_photos (job_id, company_id, uploaded_by, storage_path, caption, tag, taken_at, exif_gps, status)
  select _newjob, _gc, _uid, p.storage_path,
    coalesce(p.caption, btrim(initcap(coalesce(p.elevation,'')) || ' ' || coalesce(p.shot_type,''))),
    coalesce(p.item_key, p.category), p.taken_at,
    case when p.lat is not null then jsonb_build_object('lat',p.lat,'lng',p.lng) else null end, 'pending'
  from public.cb_photos p where p.job_id = _job;
  get diagnostics _photos = row_count;
  insert into public.job_documents (job_id, company_id, kind, title, bucket, storage_path, mime_type, source_table, source_id, created_by)
  select _newjob, _gc, 'measurement_report', 'Claim Buddy damage report v' || r.version::text,
    'cb-documents', r.pdf_path, 'application/pdf', 'cb_reports', r.id, _uid
  from public.cb_reports r where r.job_id = _job and r.pdf_path is not null
  order by r.version desc limit 1;
  insert into public.job_documents (job_id, company_id, kind, title, bucket, storage_path, mime_type, source_table, source_id, created_by)
  select _newjob, _gc, case when c.doc_type = 'contingency' then 'contingency' else 'contract' end,
    case when c.doc_type = 'contingency' then 'Signed contingency agreement' else 'Signed contract' end,
    'cb-documents', c.pdf_path, 'application/pdf', 'cb_contracts', c.id, _uid
  from public.cb_contracts c where c.job_id = _job and c.pdf_path is not null and c.signed_at is not null
  order by c.signed_at desc limit 1;
  update public.estimates
     set job_id = _newjob, company_id = coalesce(company_id, _gc), updated_at = now()
   where cb_job_id = _job and job_id is null;
  update public.cb_jobs set gc_job_id = _newjob, converted_at = now(), converted_by = _uid, status = 'converted'
   where id = _job;
  insert into public.cb_audit_log (workspace_id, actor, action, entity, entity_id, meta)
  values (j.workspace_id, _uid, 'job.converted', 'cb_jobs', _job,
    jsonb_build_object('gc_job_id', _newjob, 'gc_company_id', _gc, 'photos', _photos));
  return jsonb_build_object('gc_job_id', _newjob, 'gc_client_id', _client, 'gc_property_id', _prop,
    'roof_measurement_id', _rm, 'photos_linked', _photos, 'already', false);
end;
$function$;