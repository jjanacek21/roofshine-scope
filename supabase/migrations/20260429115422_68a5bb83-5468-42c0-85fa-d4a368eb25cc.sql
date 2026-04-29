-- Photo suggestion training decisions
CREATE TABLE public.photo_suggestion_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  photo_id UUID REFERENCES public.job_photos(id) ON DELETE SET NULL,
  estimate_id UUID REFERENCES public.estimates(id) ON DELETE SET NULL,
  suggested_code TEXT NOT NULL,
  suggested_qty NUMERIC,
  suggested_unit TEXT,
  ai_confidence TEXT CHECK (ai_confidence IN ('low','medium','high')),
  ai_description TEXT,
  source_photo_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  decision TEXT NOT NULL CHECK (decision IN ('picked','rejected','edited')),
  final_code TEXT,
  final_qty NUMERIC,
  final_unit TEXT,
  trade TEXT,
  asset_type TEXT,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by_admin UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE public.photo_suggestion_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company members read decisions"
  ON public.photo_suggestion_decisions FOR SELECT
  USING (company_id = public.auth_company_id());

CREATE POLICY "company members insert decisions"
  ON public.photo_suggestion_decisions FOR INSERT
  WITH CHECK (company_id = public.auth_company_id());

CREATE POLICY "super admin reads all decisions"
  ON public.photo_suggestion_decisions FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "super admin updates decisions"
  ON public.photo_suggestion_decisions FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE INDEX idx_psd_company ON public.photo_suggestion_decisions (company_id, decided_at DESC);
CREATE INDEX idx_psd_job ON public.photo_suggestion_decisions (job_id);
CREATE INDEX idx_psd_code ON public.photo_suggestion_decisions (suggested_code);