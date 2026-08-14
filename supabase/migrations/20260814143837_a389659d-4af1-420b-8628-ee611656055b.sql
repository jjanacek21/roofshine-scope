ALTER TABLE public.roof_sections
  ADD COLUMN IF NOT EXISTS structure_key text,
  ADD COLUMN IF NOT EXISTS pin_lat numeric,
  ADD COLUMN IF NOT EXISTS pin_lng numeric,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_polygon_geojson jsonb;

ALTER TABLE public.roof_corrections
  ADD COLUMN IF NOT EXISTS structure_key text;

CREATE UNIQUE INDEX IF NOT EXISTS roof_corrections_property_structure_key
  ON public.roof_corrections (property_id, structure_key)
  WHERE property_id IS NOT NULL AND structure_key IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roof_sections TO authenticated;
GRANT ALL ON public.roof_sections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roof_corrections TO authenticated;
GRANT ALL ON public.roof_corrections TO service_role;

CREATE OR REPLACE FUNCTION public.cb_roof_plan(_job uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _rm uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.cb_can_access_job(_job) THEN RAISE EXCEPTION 'no access'; END IF;
  _rm := public.cb_ensure_roof_measurement(_job);
  RETURN jsonb_build_object(
    'measurement_id', _rm,
    'sections', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'color', s.color,
        'polygon_geojson', s.polygon_geojson,
        'pitch', s.pitch,
        'structure_key', s.structure_key,
        'pin_lat', s.pin_lat,
        'pin_lng', s.pin_lng,
        'is_locked', s.is_locked,
        'ai_polygon_geojson', s.ai_polygon_geojson,
        'edges', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'edge_index', e.edge_index,
            'edge_type', e.edge_type,
            'length_lf', e.length_lf
          ) ORDER BY e.edge_index)
          FROM public.roof_edges e WHERE e.section_id = s.id
        ), '[]'::jsonb)
      ) ORDER BY s.sort_order)
      FROM public.roof_sections s WHERE s.measurement_id = _rm
    ), '[]'::jsonb),
    'lines', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id,
        'line_geojson', l.line_geojson,
        'line_type', l.line_type,
        'length_lf', l.length_lf
      ))
      FROM public.roof_lines l
      WHERE l.measurement_id = _rm AND coalesce(l.is_perimeter, false) = false
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cb_roof_plan(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cb_roof_plan(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cb_save_roof_plan(_job uuid, _sections jsonb, _lines jsonb, _totals jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _rm uuid; s jsonb; e jsonb; l jsonb; _sid uuid; _i int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.cb_can_access_job(_job) THEN RAISE EXCEPTION 'no access'; END IF;
  _rm := public.cb_ensure_roof_measurement(_job);

  DELETE FROM public.roof_edges WHERE section_id IN (SELECT id FROM public.roof_sections WHERE measurement_id = _rm);
  DELETE FROM public.roof_sections WHERE measurement_id = _rm;
  DELETE FROM public.roof_lines WHERE measurement_id = _rm;

  FOR s IN SELECT * FROM jsonb_array_elements(coalesce(_sections, '[]'::jsonb)) LOOP
    INSERT INTO public.roof_sections (
      measurement_id, name, color, polygon_geojson, plan_area_sqft, pitch,
      pitch_multiplier, actual_area_sqft, sort_order, structure_key, pin_lat,
      pin_lng, is_locked, ai_polygon_geojson
    ) VALUES (
      _rm, coalesce(s->>'name', 'Structure'), coalesce(s->>'color', '#f97316'),
      s->'polygon_geojson', coalesce((s->>'plan_area_sqft')::numeric, 0),
      coalesce(s->>'pitch', '6/12'), coalesce((s->>'pitch_multiplier')::numeric, 1),
      coalesce((s->>'actual_area_sqft')::numeric, 0), _i,
      nullif(s->>'structure_key', ''), nullif(s->>'pin_lat', '')::numeric,
      nullif(s->>'pin_lng', '')::numeric, coalesce((s->>'is_locked')::boolean, false),
      s->'ai_polygon_geojson'
    ) RETURNING id INTO _sid;
    FOR e IN SELECT * FROM jsonb_array_elements(coalesce(s->'edges', '[]'::jsonb)) LOOP
      INSERT INTO public.roof_edges (section_id, edge_index, edge_type, length_lf)
      VALUES (_sid, coalesce((e->>'edge_index')::int, 0), coalesce(e->>'edge_type', 'unlabeled')::roof_edge_type, coalesce((e->>'length_lf')::numeric, 0));
    END LOOP;
    _i := _i + 1;
  END LOOP;

  FOR l IN SELECT * FROM jsonb_array_elements(coalesce(_lines, '[]'::jsonb)) LOOP
    INSERT INTO public.roof_lines (measurement_id, line_geojson, line_type, length_lf, is_perimeter)
    VALUES (_rm, l->'line_geojson', coalesce(l->>'line_type', 'unlabeled')::roof_edge_type, coalesce((l->>'length_lf')::numeric, 0), false);
  END LOOP;

  UPDATE public.roof_measurements SET
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
  WHERE id = _rm;

  UPDATE public.cb_measurements SET
    total_area_sqft = coalesce((_totals->>'total_area_sqft')::numeric, total_area_sqft),
    total_squares = coalesce((_totals->>'total_squares')::numeric, total_squares),
    pitch = coalesce(_totals->>'pitch', pitch), facets = coalesce((_totals->>'facets')::int, facets),
    ridge_lf = coalesce((_totals->>'ridge_lf')::numeric, ridge_lf), hip_lf = coalesce((_totals->>'hip_lf')::numeric, hip_lf),
    valley_lf = coalesce((_totals->>'valley_lf')::numeric, valley_lf), rake_lf = coalesce((_totals->>'rake_lf')::numeric, rake_lf),
    eave_lf = coalesce((_totals->>'eave_lf')::numeric, eave_lf), gutter_lf = coalesce((_totals->>'gutter_lf')::numeric, gutter_lf),
    wall_flashing_lf = coalesce((_totals->>'wall_flashing_lf')::numeric, wall_flashing_lf),
    step_flashing_lf = coalesce((_totals->>'step_flashing_lf')::numeric, step_flashing_lf),
    rep_adjusted = coalesce((_totals->>'rep_adjusted')::boolean, rep_adjusted), source = coalesce(_totals->>'source', source), updated_at = now()
  WHERE job_id = _job;

  RETURN jsonb_build_object('measurement_id', _rm, 'sections', jsonb_array_length(coalesce(_sections, '[]'::jsonb)));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cb_save_roof_plan(uuid, jsonb, jsonb, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cb_save_roof_plan(uuid, jsonb, jsonb, jsonb) TO authenticated;