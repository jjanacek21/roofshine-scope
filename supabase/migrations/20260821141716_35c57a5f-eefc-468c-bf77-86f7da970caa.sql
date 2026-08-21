ALTER TABLE public.cb_measurements DROP CONSTRAINT IF EXISTS cb_measurements_source_check;
ALTER TABLE public.cb_measurements ADD CONSTRAINT cb_measurements_source_check
  CHECK (source = ANY (ARRAY['instant'::text,'manual'::text,'google_solar'::text,'roof_plan'::text,'photo_ai'::text,'third_party_report'::text,'mapbox_draw'::text]));