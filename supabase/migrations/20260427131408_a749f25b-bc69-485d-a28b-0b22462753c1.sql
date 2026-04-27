-- Training examples: paired ground-truth from PDFs + Solar API output, used for few-shot calibration
CREATE TABLE public.training_examples (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  address text NOT NULL,
  lat numeric,
  lng numeric,
  ground_truth jsonb NOT NULL DEFAULT '{}'::jsonb,
  solar_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'manual',
  pdf_storage_path text,
  notes text,
  source_measurement_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for nearest-neighbor lookups by lat/lng
CREATE INDEX idx_training_examples_latlng ON public.training_examples (lat, lng);
CREATE INDEX idx_training_examples_source ON public.training_examples (source);

-- RLS: super admins only
ALTER TABLE public.training_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins view training examples"
  ON public.training_examples FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Super admins insert training examples"
  ON public.training_examples FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins update training examples"
  ON public.training_examples FOR UPDATE
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Super admins delete training examples"
  ON public.training_examples FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- Auto-update updated_at
CREATE TRIGGER update_training_examples_updated_at
  BEFORE UPDATE ON public.training_examples
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add verified_at to roof_measurements
ALTER TABLE public.roof_measurements
  ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone;

ALTER TABLE public.roof_measurements
  ADD COLUMN IF NOT EXISTS verified_by uuid;
