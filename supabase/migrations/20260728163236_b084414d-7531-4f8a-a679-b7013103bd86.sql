CREATE OR REPLACE FUNCTION public.save_storm_disposition(
  p_lat double precision,
  p_lng double precision,
  p_address text,
  p_disposition public.door_disposition DEFAULT 'storm_damage',
  p_notes text DEFAULT NULL,
  p_storm jsonb DEFAULT '{}'::jsonb
)
RETURNS public.property_dispositions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hash text;
  v_row public.property_dispositions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to save a disposition';
  END IF;

  v_hash := round(p_lat::numeric, 5)::text || ',' || round(p_lng::numeric, 5)::text;

  INSERT INTO public.property_dispositions AS pd (
    user_id, address, latitude, longitude, lat, lng, lat_lng_hash,
    disposition, current_disposition, notes, metadata, created_at, updated_at
  )
  VALUES (
    v_uid,
    p_address,
    p_lat::numeric,
    p_lng::numeric,
    p_lat::numeric,
    p_lng::numeric,
    v_hash,
    p_disposition,
    p_disposition,
    p_notes,
    jsonb_build_object('storm_intel', COALESCE(p_storm, '{}'::jsonb), 'saved_from', 'storm_map'),
    now(),
    now()
  )
  ON CONFLICT (user_id, lat_lng_hash) DO UPDATE
  SET address = COALESCE(EXCLUDED.address, pd.address),
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      disposition = EXCLUDED.disposition,
      current_disposition = EXCLUDED.current_disposition,
      notes = COALESCE(EXCLUDED.notes, pd.notes),
      metadata = COALESCE(pd.metadata, '{}'::jsonb) || EXCLUDED.metadata,
      updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.export_storm_dispositions(
  p_only_storm_map boolean DEFAULT false
)
RETURNS TABLE (
  address text,
  latitude numeric,
  longitude numeric,
  disposition text,
  status text,
  notes text,
  customer_name text,
  customer_phone text,
  customer_email text,
  max_hail_in numeric,
  hail_dates text,
  last_hail_date text,
  max_wind_mph numeric,
  wind_dates text,
  last_wind_date text,
  saved_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    pd.address,
    COALESCE(pd.latitude, pd.lat)   AS latitude,
    COALESCE(pd.longitude, pd.lng)  AS longitude,
    COALESCE(pd.disposition, pd.current_disposition)::text AS disposition,
    pd.status::text AS status,
    pd.notes,
    pd.customer_name,
    pd.customer_phone,
    pd.customer_email,
    NULLIF(si ->> 'max_hail_in', '')::numeric  AS max_hail_in,
    (
      SELECT string_agg(
        (h ->> 'date') ||
        CASE WHEN (h ->> 'size_in') IS NOT NULL THEN ' (' || (h ->> 'size_in') || '")' ELSE '' END,
        '; ' ORDER BY (h ->> 'date') DESC
      )
      FROM jsonb_array_elements(COALESCE(si -> 'hail_dates', '[]'::jsonb)) AS h
    ) AS hail_dates,
    (
      SELECT max(h ->> 'date')
      FROM jsonb_array_elements(COALESCE(si -> 'hail_dates', '[]'::jsonb)) AS h
    ) AS last_hail_date,
    NULLIF(si ->> 'max_wind_mph', '')::numeric AS max_wind_mph,
    (
      SELECT string_agg(
        (w ->> 'date') ||
        CASE WHEN (w ->> 'wind_mph') IS NOT NULL THEN ' (' || (w ->> 'wind_mph') || ' mph)' ELSE '' END,
        '; ' ORDER BY (w ->> 'date') DESC
      )
      FROM jsonb_array_elements(COALESCE(si -> 'wind_dates', '[]'::jsonb)) AS w
    ) AS wind_dates,
    (
      SELECT max(w ->> 'date')
      FROM jsonb_array_elements(COALESCE(si -> 'wind_dates', '[]'::jsonb)) AS w
    ) AS last_wind_date,
    pd.created_at AS saved_at,
    pd.updated_at
  FROM public.property_dispositions pd
  CROSS JOIN LATERAL (
    SELECT COALESCE(pd.metadata -> 'storm_intel', '{}'::jsonb)
  ) AS s(si)
  WHERE pd.user_id = auth.uid()
    AND (
      NOT p_only_storm_map
      OR pd.metadata ->> 'saved_from' = 'storm_map'
    )
  ORDER BY pd.updated_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.save_storm_disposition(double precision, double precision, text, public.door_disposition, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_storm_dispositions(boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.save_storm_disposition(double precision, double precision, text, public.door_disposition, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.export_storm_dispositions(boolean) FROM anon;