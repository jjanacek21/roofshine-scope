-- Extra cost inputs on the working draft
ALTER TABLE public.job_order_drafts
  ADD COLUMN IF NOT EXISTS dump_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS permit_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_costs jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Snapshot status enum
DO $$ BEGIN
  CREATE TYPE public.order_snapshot_status AS ENUM ('draft','pending_approval','approved','superseded','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Version + approval columns on snapshots
ALTER TABLE public.job_order_snapshots
  ADD COLUMN IF NOT EXISTS version_number integer,
  ADD COLUMN IF NOT EXISTS status public.order_snapshot_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_notes text,
  ADD COLUMN IF NOT EXISTS dump_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS permit_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_costs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_squares numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS per_sq_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_per_sq numeric NOT NULL DEFAULT 0;

-- Backfill version_number for existing snapshots
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY created_at) AS rn
  FROM public.job_order_snapshots
  WHERE version_number IS NULL
)
UPDATE public.job_order_snapshots s
   SET version_number = ranked.rn
  FROM ranked
 WHERE s.id = ranked.id;

-- Trigger to assign next version on insert
CREATE OR REPLACE FUNCTION public.assign_order_snapshot_version()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.version_number IS NULL THEN
    SELECT COALESCE(MAX(version_number), 0) + 1
      INTO NEW.version_number
      FROM public.job_order_snapshots
     WHERE job_id = NEW.job_id;
  END IF;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assign_order_snapshot_version ON public.job_order_snapshots;
CREATE TRIGGER trg_assign_order_snapshot_version
  BEFORE INSERT ON public.job_order_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.assign_order_snapshot_version();

-- Allow update + delete (currently blocked by missing policies)
CREATE POLICY "company member update snapshots" ON public.job_order_snapshots
  FOR UPDATE USING (company_id = public.auth_company_id())
  WITH CHECK (company_id = public.auth_company_id());

CREATE POLICY "author delete draft snapshots" ON public.job_order_snapshots
  FOR DELETE USING (
    company_id = public.auth_company_id()
    AND status = 'draft'
    AND (created_by = auth.uid() OR public.is_company_admin())
  );

-- Audit history
CREATE TABLE IF NOT EXISTS public.job_order_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  job_id uuid NOT NULL,
  snapshot_id uuid REFERENCES public.job_order_snapshots(id) ON DELETE SET NULL,
  action text NOT NULL,
  actor uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.job_order_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company view history" ON public.job_order_history FOR SELECT
  USING (company_id = public.auth_company_id());
CREATE POLICY "company insert history" ON public.job_order_history FOR INSERT
  WITH CHECK (company_id = public.auth_company_id());

-- RPCs
CREATE OR REPLACE FUNCTION public.submit_order_snapshot(_id uuid)
RETURNS public.job_order_snapshots LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.job_order_snapshots%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.job_order_snapshots WHERE id = _id;
  IF NOT FOUND OR v.company_id <> public.auth_company_id() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF v.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft snapshots can be submitted';
  END IF;
  UPDATE public.job_order_snapshots
     SET status = 'pending_approval', submitted_at = now()
   WHERE id = _id RETURNING * INTO v;
  INSERT INTO public.job_order_history (company_id, job_id, snapshot_id, action, actor)
    VALUES (v.company_id, v.job_id, v.id, 'submit', auth.uid());
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.approve_order_snapshot(_id uuid, _note text DEFAULT NULL)
RETURNS public.job_order_snapshots LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.job_order_snapshots%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.job_order_snapshots WHERE id = _id;
  IF NOT FOUND OR v.company_id <> public.auth_company_id() OR NOT public.is_company_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF v.status NOT IN ('pending_approval','draft') THEN
    RAISE EXCEPTION 'Snapshot is not approvable in its current state';
  END IF;
  -- Supersede any prior approved snapshot for this job
  UPDATE public.job_order_snapshots
     SET status = 'superseded'
   WHERE job_id = v.job_id AND status = 'approved' AND id <> v.id;
  UPDATE public.job_order_snapshots
     SET status = 'approved', approved_by = auth.uid(), approved_at = now(), approval_notes = _note
   WHERE id = _id RETURNING * INTO v;
  INSERT INTO public.job_order_history (company_id, job_id, snapshot_id, action, actor, payload)
    VALUES (v.company_id, v.job_id, v.id, 'approve', auth.uid(), jsonb_build_object('note', _note));
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.reject_order_snapshot(_id uuid, _note text DEFAULT NULL)
RETURNS public.job_order_snapshots LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.job_order_snapshots%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.job_order_snapshots WHERE id = _id;
  IF NOT FOUND OR v.company_id <> public.auth_company_id() OR NOT public.is_company_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF v.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Only pending snapshots can be rejected';
  END IF;
  UPDATE public.job_order_snapshots
     SET status = 'rejected', approval_notes = _note
   WHERE id = _id RETURNING * INTO v;
  INSERT INTO public.job_order_history (company_id, job_id, snapshot_id, action, actor, payload)
    VALUES (v.company_id, v.job_id, v.id, 'reject', auth.uid(), jsonb_build_object('note', _note));
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.rollback_order_snapshot(_id uuid)
RETURNS public.job_order_drafts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.job_order_snapshots%ROWTYPE;
  d public.job_order_drafts%ROWTYPE;
  prev jsonb;
BEGIN
  SELECT * INTO v FROM public.job_order_snapshots WHERE id = _id;
  IF NOT FOUND OR v.company_id <> public.auth_company_id() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT * INTO d FROM public.job_order_drafts WHERE job_id = v.job_id;
  IF FOUND THEN
    prev := to_jsonb(d);
    UPDATE public.job_order_drafts
       SET inputs = COALESCE(v.inputs, '{}'::jsonb),
           dump_cost = v.dump_cost,
           permit_cost = v.permit_cost,
           extra_costs = COALESCE(v.extra_costs, '[]'::jsonb),
           material_overrides = COALESCE((v.materials), '[]'::jsonb),
           labor_overrides = COALESCE((v.labor), '[]'::jsonb)
     WHERE job_id = v.job_id RETURNING * INTO d;
  ELSE
    INSERT INTO public.job_order_drafts (job_id, company_id, inputs, dump_cost, permit_cost, extra_costs, material_overrides, labor_overrides)
      VALUES (v.job_id, v.company_id, COALESCE(v.inputs, '{}'::jsonb), v.dump_cost, v.permit_cost,
              COALESCE(v.extra_costs, '[]'::jsonb), COALESCE(v.materials, '[]'::jsonb), COALESCE(v.labor, '[]'::jsonb))
      RETURNING * INTO d;
  END IF;

  INSERT INTO public.job_order_history (company_id, job_id, snapshot_id, action, actor, payload)
    VALUES (v.company_id, v.job_id, v.id, 'rollback', auth.uid(),
            jsonb_build_object('rolled_back_to_version', v.version_number, 'previous_draft', prev));
  RETURN d;
END $$;