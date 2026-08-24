ALTER TABLE public.cb_workspaces
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_comp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.cb_workspace_members
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.cb_workspaces ADD CONSTRAINT cb_workspaces_tier_chk CHECK (tier IN ('basic','pro','elite'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.cb_workspaces ADD CONSTRAINT cb_workspaces_status_chk CHECK (status IN ('active','suspended','archived'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE public.cb_workspaces
SET tier = CASE plan WHEN 'team' THEN 'elite' WHEN 'pro' THEN 'pro' ELSE 'basic' END
WHERE tier = 'basic';

UPDATE public.cb_workspaces
SET tier = 'elite', is_comp = true
WHERE origin = 'platform' OR name ILIKE '%Global Contractor%';

CREATE OR REPLACE FUNCTION public.cb_tier_defaults(_tier text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(_tier,'basic'))
    WHEN 'elite' THEN '{"ai_measure":true,"survival_guide":true,"price_book":true,"storm_intel":true}'::jsonb
    WHEN 'pro'   THEN '{"ai_measure":true,"survival_guide":true,"price_book":false,"storm_intel":false}'::jsonb
    ELSE              '{"ai_measure":false,"survival_guide":false,"price_book":false,"storm_intel":false}'::jsonb
  END
$$;

CREATE OR REPLACE FUNCTION public.cb_resolved_features(_ws public.cb_workspaces)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _ws.is_comp THEN public.cb_tier_defaults('elite')
    ELSE public.cb_tier_defaults(_ws.tier) || coalesce(_ws.features, '{}'::jsonb)
  END
$$;

CREATE OR REPLACE FUNCTION public.cb_has_feature(_ws uuid, _feature text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((
    SELECT (public.cb_resolved_features(w) ->> _feature)::boolean
    FROM public.cb_workspaces w
    WHERE w.id = _ws AND w.status = 'active'
  ), false)
$$;

CREATE OR REPLACE FUNCTION public.cb_my_context()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'user_id', auth.uid(),
    'has_gc_access', public.cb_has_gc_access(),
    'gc_company_id', public.cb_gc_company_id(),
    'workspaces', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', w.id, 'name', w.name, 'origin', w.origin,
        'gc_company_id', w.gc_company_id, 'plan', w.plan,
        'measure_credits', w.measure_credits, 'role', m.role,
        'seats_purchased', w.seats_purchased,
        'tier', w.tier, 'status', w.status, 'is_comp', w.is_comp,
        'features', public.cb_resolved_features(w)))
      FROM public.cb_workspaces w
      JOIN public.cb_workspace_members m ON m.workspace_id = w.id
      WHERE m.user_id = auth.uid()
        AND coalesce(m.is_active, true)
        AND w.status = 'active'), '[]'::jsonb));
$$;