-- ============================================================
-- GCN Storm Intelligence — data seed. Part 2 of 2.
-- ============================================================

WITH targets(ugc, cname, st, fips) AS (
  VALUES ('FLC011','Broward County','FL','12011'),
         ('FLC099','Palm Beach County','FL','12099'),
         ('FLC086','Miami-Dade County','FL','12086'),
         ('TXC113','Dallas County','TX','48113')
),
resp AS (
  SELECT t.*, (extensions.http((
    'GET',
    'https://api.weather.gov/zones/county/' || t.ugc,
    ARRAY[extensions.http_header('User-Agent','GCN-StormIntel/1.0 (j.janacek21@gmail.com)'),
          extensions.http_header('Accept','application/geo+json')],
    NULL, NULL
  )::extensions.http_request)).content::jsonb AS j
  FROM targets t
)
INSERT INTO territories (name, state, county_fips, source, geom)
SELECT cname, st, fips, 'census_county',
       ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON((j->'geometry')::text), 4326)))
FROM resp
WHERE j->'geometry' IS NOT NULL
ON CONFLICT (source, county_fips)
DO UPDATE SET geom = EXCLUDED.geom, name = EXCLUDED.name;

WITH urls(u) AS (
  VALUES
    ('https://api.weather.gov/alerts/active?event=Severe%20Thunderstorm%20Warning&area=FL'),
    ('https://api.weather.gov/alerts/active?event=Severe%20Thunderstorm%20Warning&area=TX'),
    ('https://api.weather.gov/alerts?event=Severe%20Thunderstorm%20Warning&area=FL&start='
       || to_char(now() - interval '72 hours', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || '&end='
       || to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || '&limit=100'),
    ('https://api.weather.gov/alerts?event=Severe%20Thunderstorm%20Warning&area=TX&start='
       || to_char(now() - interval '72 hours', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || '&end='
       || to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || '&limit=100')
),
resp AS (
  SELECT (extensions.http((
    'GET', u,
    ARRAY[extensions.http_header('User-Agent','GCN-StormIntel/1.0 (j.janacek21@gmail.com)'),
          extensions.http_header('Accept','application/geo+json')],
    NULL, NULL
  )::extensions.http_request)).content::jsonb AS j
  FROM urls
),
feat AS (
  SELECT DISTINCT ON (f->'properties'->>'id') f
  FROM resp, jsonb_array_elements(j->'features') f
  WHERE f->'geometry' IS NOT NULL
)
INSERT INTO wind_events (event_time, wind_mph, geom, source, nws_event_id, dedupe_key, raw)
SELECT
  (f->'properties'->>'onset')::timestamptz,
  NULLIF(regexp_replace(COALESCE(f->'properties'->'parameters'->'maxWindGust'->>0,
                                 f->'properties'->'parameters'->'windGust'->>0, ''),
                        '[^0-9].*$', ''), '')::int,
  ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON((f->'geometry')::text), 4326)),
  'SVR_WARNING',
  f->'properties'->>'id',
  f->'properties'->>'id',
  jsonb_build_object(
    'areaDesc', f->'properties'->>'areaDesc',
    'headline', f->'properties'->>'headline',
    'expires',  f->'properties'->>'expires',
    'maxHailSize', f->'properties'->'parameters'->'maxHailSize'->>0,
    'maxWindGust', f->'properties'->'parameters'->'maxWindGust'->>0)
FROM feat
ON CONFLICT (dedupe_key) DO NOTHING;