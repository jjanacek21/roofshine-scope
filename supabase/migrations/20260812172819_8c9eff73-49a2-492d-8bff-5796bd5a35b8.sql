-- Pre-launch: stop metering from blocking anyone, keep the mechanism intact.
ALTER TABLE public.cb_workspaces
  ALTER COLUMN measure_credits SET DEFAULT 999999;

ALTER TABLE public.cb_workspaces
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'prelaunch';

UPDATE public.cb_workspaces SET measure_credits = 999999 WHERE measure_credits < 999999;

-- Plan-based limits: flip a plan's grant to a real number to re-enable metering.
CREATE TABLE IF NOT EXISTS public.cb_plan_limits (
  plan text PRIMARY KEY,
  measure_credits_grant integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cb_plan_limits TO authenticated;
GRANT ALL ON public.cb_plan_limits TO service_role;

ALTER TABLE public.cb_plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read plan limits"
  ON public.cb_plan_limits FOR SELECT TO authenticated USING (true);

INSERT INTO public.cb_plan_limits (plan, measure_credits_grant) VALUES
  ('prelaunch', 999999),
  ('free', 3),
  ('pro', 500)
ON CONFLICT (plan) DO NOTHING;