alter table public.cb_measurements
  add column if not exists gc_roof_measurement_id uuid references public.roof_measurements(id) on delete set null;

create or replace function public.cb_ensure_roof_measurement(_job uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  j public.cb_jobs%rowtype;
  _co uuid; _prop uuid; _rm uuid; _existing uuid; _d numeric := 0.00015;
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  if not public.cb_can_access_job(_job) then raise exception 'no access'; end if;
  select * into j from public.cb_jobs where id = _job;

  select gc_roof_measurement_id into _existing from public.cb_measurements where job_id = _job;
  if _existing is not null then return _existing; end if;

  _co := public.cb_gc_company_id();
  if _co is null then
    select gc_company_id into _co from public.cb_workspaces where id = j.workspace_id;
  end if;
  if _co is null then
    select company_id into _co from public.profiles where id = _uid;
  end if;
  if _co is null then
    select id into _co from public.companies where name = 'Claim Buddy ' || j.workspace_id::text limit 1;
    if _co is null then
      insert into public.companies (name) values ('Claim Buddy ' || j.workspace_id::text) returning id into _co;
    end if;
  end if;

  if j.lat is not null and j.lng is not null then
    select id into _prop from public.properties
     where company_id = _co
       and lat between j.lat - _d and j.lat + _d
       and lng between j.lng - _d and j.lng + _d
     limit 1;
  end if;
  if _prop is null then
    insert into public.properties (company_id, address, city, state, zip, lat, lng)
    values (_co, coalesce(nullif(j.address,''),'Claim Buddy inspection'), j.city, j.state, j.zip, j.lat, j.lng)
    returning id into _prop;
  end if;

  select id into _rm from public.roof_measurements where property_id = _prop order by created_at desc limit 1;
  if _rm is null then
    insert into public.roof_measurements (property_id, company_id, source, created_by, notes)
    values (_prop, _co, 'manual'::roof_measurement_source, _uid, 'Claim Buddy roof plan')
    returning id into _rm;
  end if;

  insert into public.cb_measurements (job_id, gc_roof_measurement_id)
  values (_job, _rm)
  on conflict (job_id) do update set gc_roof_measurement_id = excluded.gc_roof_measurement_id;

  return _rm;
end;
$$;

grant execute on function public.cb_ensure_roof_measurement(uuid) to authenticated;

create or replace function public.cb_roof_plan(_job uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare _rm uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.cb_can_access_job(_job) then raise exception 'no access'; end if;
  select gc_roof_measurement_id into _rm from public.cb_measurements where job_id = _job;
  if _rm is null then
    return jsonb_build_object('measurement_id', null, 'sections', '[]'::jsonb, 'lines', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'measurement_id', _rm,
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'color', s.color, 'polygon_geojson', s.polygon_geojson,
        'plan_area_sqft', s.plan_area_sqft, 'pitch', s.pitch, 'pitch_multiplier', s.pitch_multiplier,
        'actual_area_sqft', s.actual_area_sqft, 'sort_order', s.sort_order,
        'edges', coalesce((select jsonb_agg(jsonb_build_object('edge_index', e.edge_index, 'edge_type', e.edge_type, 'length_lf', e.length_lf) order by e.edge_index)
                            from public.roof_edges e where e.section_id = s.id), '[]'::jsonb)
      ) order by s.sort_order)
      from public.roof_sections s where s.measurement_id = _rm), '[]'::jsonb),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'line_geojson', l.line_geojson, 'line_type', l.line_type, 'length_lf', l.length_lf))
      from public.roof_lines l where l.measurement_id = _rm and coalesce(l.is_perimeter,false) = false), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.cb_roof_plan(uuid) to authenticated;

create or replace function public.cb_save_roof_plan(_job uuid, _sections jsonb, _lines jsonb, _totals jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare _rm uuid; s jsonb; e jsonb; l jsonb; _sid uuid; _i int := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.cb_can_access_job(_job) then raise exception 'no access'; end if;
  _rm := public.cb_ensure_roof_measurement(_job);

  delete from public.roof_edges where section_id in (select id from public.roof_sections where measurement_id = _rm);
  delete from public.roof_sections where measurement_id = _rm;
  delete from public.roof_lines where measurement_id = _rm;

  for s in select * from jsonb_array_elements(coalesce(_sections,'[]'::jsonb)) loop
    insert into public.roof_sections (measurement_id, name, color, polygon_geojson, plan_area_sqft, pitch, pitch_multiplier, actual_area_sqft, sort_order)
    values (_rm, coalesce(s->>'name','Structure'), coalesce(s->>'color','#f97316'), s->'polygon_geojson',
            coalesce((s->>'plan_area_sqft')::numeric,0), coalesce(s->>'pitch','6/12'),
            coalesce((s->>'pitch_multiplier')::numeric,1), coalesce((s->>'actual_area_sqft')::numeric,0), _i)
    returning id into _sid;
    for e in select * from jsonb_array_elements(coalesce(s->'edges','[]'::jsonb)) loop
      insert into public.roof_edges (section_id, edge_index, edge_type, length_lf)
      values (_sid, coalesce((e->>'edge_index')::int,0), coalesce(e->>'edge_type','eave')::roof_edge_type, coalesce((e->>'length_lf')::numeric,0));
    end loop;
    _i := _i + 1;
  end loop;

  for l in select * from jsonb_array_elements(coalesce(_lines,'[]'::jsonb)) loop
    insert into public.roof_lines (measurement_id, line_geojson, line_type, length_lf, is_perimeter)
    values (_rm, l->'line_geojson', coalesce(l->>'line_type','ridge')::roof_edge_type, coalesce((l->>'length_lf')::numeric,0), false);
  end loop;

  update public.roof_measurements set
    total_area_sqft = coalesce((_totals->>'total_area_sqft')::numeric, total_area_sqft),
    squares = coalesce((_totals->>'total_squares')::numeric, squares),
    predominant_pitch = coalesce(_totals->>'pitch', predominant_pitch),
    ridges_lf = coalesce((_totals->>'ridge_lf')::numeric, ridges_lf),
    hips_lf = coalesce((_totals->>'hip_lf')::numeric, hips_lf),
    valleys_lf = coalesce((_totals->>'valley_lf')::numeric, valleys_lf),
    rakes_lf = coalesce((_totals->>'rake_lf')::numeric, rakes_lf),
    eaves_lf = coalesce((_totals->>'eave_lf')::numeric, eaves_lf),
    gutters_lf = coalesce((_totals->>'gutter_lf')::numeric, gutters_lf),
    wall_flashing_lf = coalesce((_totals->>'wall_flashing_lf')::numeric, wall_flashing_lf),
    step_flashing_lf = coalesce((_totals->>'step_flashing_lf')::numeric, step_flashing_lf),
    updated_at = now()
  where id = _rm;

  update public.cb_measurements set
    total_area_sqft = coalesce((_totals->>'total_area_sqft')::numeric, total_area_sqft),
    total_squares = coalesce((_totals->>'total_squares')::numeric, total_squares),
    pitch = coalesce(_totals->>'pitch', pitch),
    facets = coalesce((_totals->>'facets')::int, facets),
    ridge_lf = coalesce((_totals->>'ridge_lf')::numeric, ridge_lf),
    hip_lf = coalesce((_totals->>'hip_lf')::numeric, hip_lf),
    valley_lf = coalesce((_totals->>'valley_lf')::numeric, valley_lf),
    rake_lf = coalesce((_totals->>'rake_lf')::numeric, rake_lf),
    eave_lf = coalesce((_totals->>'eave_lf')::numeric, eave_lf),
    gutter_lf = coalesce((_totals->>'gutter_lf')::numeric, gutter_lf),
    wall_flashing_lf = coalesce((_totals->>'wall_flashing_lf')::numeric, wall_flashing_lf),
    step_flashing_lf = coalesce((_totals->>'step_flashing_lf')::numeric, step_flashing_lf),
    rep_adjusted = coalesce((_totals->>'rep_adjusted')::boolean, rep_adjusted),
    source = coalesce(_totals->>'source', source),
    updated_at = now()
  where job_id = _job;

  return jsonb_build_object('measurement_id', _rm, 'sections', jsonb_array_length(coalesce(_sections,'[]'::jsonb)));
end;
$$;

grant execute on function public.cb_save_roof_plan(uuid, jsonb, jsonb, jsonb) to authenticated;

create or replace function public.cb_convert_to_job(_job uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  update public.cb_jobs set gc_job_id = _newjob, converted_at = now(), converted_by = _uid, status = 'converted'
   where id = _job;
  insert into public.cb_audit_log (workspace_id, actor, action, entity, entity_id, meta)
  values (j.workspace_id, _uid, 'job.converted', 'cb_jobs', _job,
    jsonb_build_object('gc_job_id', _newjob, 'gc_company_id', _gc, 'photos', _photos));
  return jsonb_build_object('gc_job_id', _newjob, 'gc_client_id', _client, 'gc_property_id', _prop,
    'roof_measurement_id', _rm, 'photos_linked', _photos, 'already', false);
end;
$$;