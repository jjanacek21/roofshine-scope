-- ============================================================
-- GCN Storm Intelligence — FULL migration for the Lovable app's
-- Supabase project. Idempotent: safe to run more than once.
-- Part 1 of 2 (run supabase_seed.sql after this).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- ---------- tables ----------

CREATE TABLE IF NOT EXISTS territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID,
  name TEXT NOT NULL,
  state TEXT,
  county_fips TEXT,
  source TEXT DEFAULT 'manual',
  geom GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (source, county_fips)
);

CREATE TABLE IF NOT EXISTS hail_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_time TIMESTAMPTZ NOT NULL,
  hail_size_in NUMERIC(4,2) NOT NULL,
  lat NUMERIC(8,5) NOT NULL,
  lon NUMERIC(9,5) NOT NULL,
  geom GEOMETRY(POINT, 4326) NOT NULL,
  source TEXT NOT NULL DEFAULT 'MRMS_MESH',
  mesh_product TEXT NOT NULL,
  ingested_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (mesh_product, event_time, lat, lon)
);

CREATE TABLE IF NOT EXISTS wind_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_time TIMESTAMPTZ NOT NULL,
  wind_mph INT,
  geom GEOMETRY(GEOMETRY, 4326) NOT NULL,
  source TEXT NOT NULL,
  nws_event_id TEXT,
  dedupe_key TEXT NOT NULL UNIQUE,
  raw JSONB,
  ingested_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storm_swaths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date DATE NOT NULL,
  band_label TEXT NOT NULL,
  min_size_in NUMERIC(4,2) NOT NULL,
  max_size_in NUMERIC(4,2),
  mesh_product TEXT NOT NULL DEFAULT 'MESH_Max_1440min',
  color_hex TEXT,
  geom GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_date, band_label, mesh_product)
);

CREATE TABLE IF NOT EXISTS property_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID,
  county TEXT,
  zip_code TEXT,
  roof_age INT,
  property_value NUMERIC,
  hail_hits INT DEFAULT 0,
  flood_risk_zone TEXT,
  last_storm_date DATE,
  risk_score NUMERIC(3,2),
  geom GEOMETRY(POINT, 4326),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingest_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job TEXT NOT NULL,
  grid_valid_time TIMESTAMPTZ,
  source_url TEXT,
  cells_found INT,
  rows_upserted INT,
  status TEXT NOT NULL,
  detail TEXT,
  ran_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_territories_geom ON territories USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_hail_geom ON hail_events USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_hail_time ON hail_events (event_time);
CREATE INDEX IF NOT EXISTS idx_wind_geom ON wind_events USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_wind_time ON wind_events (event_time);
CREATE INDEX IF NOT EXISTS idx_swath_geom ON storm_swaths USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_swath_date ON storm_swaths (event_date);
CREATE INDEX IF NOT EXISTS idx_prop_geom ON property_intelligence USING GIST (geom);

-- ---------- RLS ----------

ALTER TABLE territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE hail_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE wind_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE storm_swaths ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY read_territories ON territories FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY read_hail ON hail_events FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY read_wind ON wind_events FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY read_swaths ON storm_swaths FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Grants for Data API (required for PostgREST to reach these tables)
GRANT SELECT ON territories, hail_events, wind_events, storm_swaths TO anon, authenticated;
GRANT ALL ON territories, hail_events, wind_events, storm_swaths, property_intelligence, ingest_runs TO service_role;

-- ---------- swath generation (service-role only) ----------

CREATE OR REPLACE FUNCTION generate_storm_swaths(
  p_event_date date,
  p_product    text DEFAULT 'MESH_Max_1440min',
  p_simplify   double precision DEFAULT 0.0005
)
RETURNS TABLE(band text, cells int, area_sq_mi numeric)
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM storm_swaths s
   WHERE s.event_date = p_event_date AND s.mesh_product = p_product;

  RETURN QUERY
  WITH bands(label, min_in, max_in, color) AS (
    VALUES ('0.75-1in', 0.75::numeric, 1.00::numeric, '#FFD400'),
           ('1-1.5in',  1.00, 1.50, '#FFA500'),
           ('1.5-2in',  1.50, 2.00, '#FF4500'),
           ('2-3in',    2.00, 3.00, '#D0021B'),
           ('3in+',     3.00, NULL, '#7B1FA2')
  ),
  cell_max AS (
    SELECT h.lat, h.lon, max(h.hail_size_in) AS size_in
    FROM hail_events h
    WHERE h.event_time >= p_event_date::timestamptz
      AND h.event_time <  (p_event_date + 1)::timestamptz
      AND h.mesh_product = p_product
    GROUP BY h.lat, h.lon
  ),
  squares AS (
    SELECT c.size_in,
           ST_MakeEnvelope(c.lon - 0.005, c.lat - 0.005,
                           c.lon + 0.005, c.lat + 0.005, 4326) AS cell
    FROM cell_max c
  ),
  banded AS (
    SELECT b.label, b.min_in, b.max_in, b.color,
           count(*)::int AS n_cells,
           ST_Multi(ST_SimplifyPreserveTopology(
             ST_UnaryUnion(ST_Collect(s.cell)), p_simplify)) AS geom
    FROM squares s
    JOIN bands b
      ON s.size_in >= b.min_in AND (b.max_in IS NULL OR s.size_in < b.max_in)
    GROUP BY b.label, b.min_in, b.max_in, b.color
  ),
  ins AS (
    INSERT INTO storm_swaths (event_date, band_label, min_size_in, max_size_in,
                              mesh_product, color_hex, geom)
    SELECT p_event_date, label, min_in, max_in, p_product, color, geom
    FROM banded
    RETURNING band_label, geom
  )
  SELECT i.band_label, b2.n_cells,
         (ST_Area(i.geom::geography) / 2589988.11)::numeric(10,2)
  FROM ins i JOIN banded b2 ON b2.label = i.band_label;
END $$;

-- ---------- frontend RPCs (anon-readable, GeoJSON) ----------

CREATE OR REPLACE FUNCTION swath_geojson(
  p_event_date date,
  p_product    text DEFAULT 'MESH_Max_1440min'
)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(jsonb_build_object(
    'type', 'FeatureCollection',
    'features', jsonb_agg(
      jsonb_build_object(
        'type', 'Feature',
        'properties', jsonb_build_object(
          'band', s.band_label, 'min_in', s.min_size_in, 'max_in', s.max_size_in,
          'color', s.color_hex, 'event_date', s.event_date, 'product', s.mesh_product),
        'geometry', ST_AsGeoJSON(s.geom, 5)::jsonb)
      ORDER BY s.min_size_in)),
    jsonb_build_object('type','FeatureCollection','features','[]'::jsonb))
  FROM storm_swaths s
  WHERE s.event_date = p_event_date AND s.mesh_product = p_product;
$$;

CREATE OR REPLACE FUNCTION wind_geojson(p_hours int DEFAULT 72)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(jsonb_build_object(
    'type','FeatureCollection',
    'features', jsonb_agg(jsonb_build_object(
      'type','Feature',
      'properties', jsonb_build_object(
        'source', w.source, 'wind_mph', w.wind_mph, 'event_time', w.event_time,
        'area', w.raw->>'areaDesc', 'headline', w.raw->>'headline'),
      'geometry', ST_AsGeoJSON(w.geom, 5)::jsonb)
      ORDER BY w.event_time DESC)),
    jsonb_build_object('type','FeatureCollection','features','[]'::jsonb))
  FROM wind_events w
  WHERE w.event_time > now() - make_interval(hours => p_hours);
$$;

CREATE OR REPLACE FUNCTION territories_geojson()
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(jsonb_build_object(
    'type','FeatureCollection',
    'features', jsonb_agg(jsonb_build_object(
      'type','Feature',
      'properties', jsonb_build_object('id', t.id, 'name', t.name, 'state', t.state),
      'geometry', ST_AsGeoJSON(t.geom, 5)::jsonb))),
    jsonb_build_object('type','FeatureCollection','features','[]'::jsonb))
  FROM territories t;
$$;

CREATE OR REPLACE FUNCTION swath_dates()
RETURNS TABLE(event_date date, mesh_product text, bands int, max_size_in numeric)
LANGUAGE sql STABLE AS $$
  SELECT s.event_date, s.mesh_product, count(*)::int,
         max(COALESCE(s.max_size_in, s.min_size_in))
  FROM storm_swaths s
  GROUP BY s.event_date, s.mesh_product
  ORDER BY s.event_date DESC;
$$;

REVOKE ALL ON FUNCTION generate_storm_swaths(date, text, double precision) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION swath_geojson(date, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION wind_geojson(int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION territories_geojson() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION swath_dates() TO anon, authenticated;