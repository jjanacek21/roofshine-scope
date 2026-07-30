-- Let any signed-in user contribute a roof correction as training data
CREATE POLICY "Users insert their own training examples"
  ON public.training_examples FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users view their own training examples"
  ON public.training_examples FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- Provenance: link a saved measurement back to the AI run it came from
ALTER TABLE public.roof_measurements
  ADD COLUMN IF NOT EXISTS ai_run_id uuid REFERENCES public.ai_measurement_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_geometry jsonb;

CREATE INDEX IF NOT EXISTS roof_measurements_ai_run_id_idx
  ON public.roof_measurements(ai_run_id);