
-- AI measurement runs log
CREATE TABLE public.ai_measurement_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  requested_lat numeric NOT NULL,
  requested_lng numeric NOT NULL,
  property_id uuid,
  company_id uuid,
  job_id uuid,
  user_id uuid,
  provider text NOT NULL DEFAULT 'google_solar',
  status text NOT NULL DEFAULT 'success', -- success | no_coverage | error
  imagery_quality text,
  imagery_date jsonb,
  total_plan_sqft numeric NOT NULL DEFAULT 0,
  total_actual_sqft numeric NOT NULL DEFAULT 0,
  predominant_pitch text,
  segment_count integer NOT NULL DEFAULT 0,
  segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- review state
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_status text NOT NULL DEFAULT 'pending', -- pending | corrected | verified | rejected
  correction_measurement_id uuid,
  training_example_id uuid,
  notes text
);

CREATE INDEX idx_ai_runs_created_at ON public.ai_measurement_runs (created_at DESC);
CREATE INDEX idx_ai_runs_company ON public.ai_measurement_runs (company_id);
CREATE INDEX idx_ai_runs_review_status ON public.ai_measurement_runs (review_status);

ALTER TABLE public.ai_measurement_runs ENABLE ROW LEVEL SECURITY;

-- Super admins manage everything
CREATE POLICY "Super admins manage ai measurement runs"
  ON public.ai_measurement_runs FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Company members can view their own runs (insert handled server-side via service role)
CREATE POLICY "Company members view their ai runs"
  ON public.ai_measurement_runs FOR SELECT
  TO authenticated
  USING (company_id = auth_company_id());

-- updated_at trigger
CREATE TRIGGER trg_ai_runs_updated_at
  BEFORE UPDATE ON public.ai_measurement_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Super-admin policies for jobs / properties / clients so admin can manage test data
CREATE POLICY "Super admins manage all jobs"
  ON public.jobs FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins manage all clients"
  ON public.clients FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
