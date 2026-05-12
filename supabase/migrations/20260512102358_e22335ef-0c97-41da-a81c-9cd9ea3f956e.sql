
-- Add ownership columns
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS assigned_to uuid;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assigned_to uuid;

CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to ON public.jobs(assigned_to);
CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON public.jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);

-- Auto-stamp triggers
CREATE OR REPLACE FUNCTION public.stamp_job_ownership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  IF NEW.assigned_to IS NULL THEN NEW.assigned_to := NEW.created_by; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stamp_job_ownership ON public.jobs;
CREATE TRIGGER trg_stamp_job_ownership BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.stamp_job_ownership();

CREATE OR REPLACE FUNCTION public.stamp_lead_ownership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  IF NEW.assigned_to IS NULL THEN NEW.assigned_to := NEW.created_by; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stamp_lead_ownership ON public.leads;
CREATE TRIGGER trg_stamp_lead_ownership BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.stamp_lead_ownership();

-- Backfill: assign existing rows to a company owner/admin
UPDATE public.jobs j
   SET created_by = COALESCE(j.created_by, (
     SELECT p.id FROM public.profiles p
      WHERE p.company_id = j.company_id AND p.role IN ('owner','admin','super_admin')
      ORDER BY (p.role = 'owner') DESC, p.created_at ASC LIMIT 1
   )),
       assigned_to = COALESCE(j.assigned_to, j.created_by, (
     SELECT p.id FROM public.profiles p
      WHERE p.company_id = j.company_id AND p.role IN ('owner','admin','super_admin')
      ORDER BY (p.role = 'owner') DESC, p.created_at ASC LIMIT 1
   ))
 WHERE j.created_by IS NULL OR j.assigned_to IS NULL;

UPDATE public.leads l
   SET assigned_to = COALESCE(l.assigned_to, l.created_by)
 WHERE l.assigned_to IS NULL;

-- RLS: replace SELECT/UPDATE/DELETE on jobs to scope reps to their own
DROP POLICY IF EXISTS "Company members view jobs" ON public.jobs;
CREATE POLICY "Company members view jobs" ON public.jobs FOR SELECT TO authenticated
  USING (
    company_id = auth_company_id()
    AND (is_company_admin() OR created_by = auth.uid() OR assigned_to = auth.uid())
  );

DROP POLICY IF EXISTS "Company members update jobs" ON public.jobs;
CREATE POLICY "Company members update jobs" ON public.jobs FOR UPDATE TO authenticated
  USING (
    company_id = auth_company_id()
    AND (is_company_admin() OR created_by = auth.uid() OR assigned_to = auth.uid())
  );

DROP POLICY IF EXISTS "Company members delete jobs" ON public.jobs;
CREATE POLICY "Company members delete jobs" ON public.jobs FOR DELETE TO authenticated
  USING (
    company_id = auth_company_id()
    AND (is_company_admin() OR created_by = auth.uid())
  );

-- Leads: scope view/update to admin or own (created_by/assigned_to)
DROP POLICY IF EXISTS "Company members view leads" ON public.leads;
CREATE POLICY "Company members view leads" ON public.leads FOR SELECT TO authenticated
  USING (
    is_super_admin() OR (
      company_id = auth_company_id()
      AND (is_company_admin() OR created_by = auth.uid() OR assigned_to = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Company members update leads" ON public.leads;
CREATE POLICY "Company members update leads" ON public.leads FOR UPDATE TO authenticated
  USING (
    is_super_admin() OR (
      company_id = auth_company_id()
      AND (is_company_admin() OR created_by = auth.uid() OR assigned_to = auth.uid())
    )
  );

-- Allow same-company members to view each other's profile basics (for rep names/dropdown)
DROP POLICY IF EXISTS "Company members view company profiles" ON public.profiles;
CREATE POLICY "Company members view company profiles" ON public.profiles FOR SELECT TO authenticated
  USING (company_id IS NOT NULL AND company_id = auth_company_id());
