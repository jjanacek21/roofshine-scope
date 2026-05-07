
-- Status enum
DO $$ BEGIN
  CREATE TYPE public.join_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.company_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status public.join_request_status NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid,
  note text
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_company_join_requests_pending
  ON public.company_join_requests (user_id, company_id)
  WHERE status = 'pending';

ALTER TABLE public.company_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own join requests" ON public.company_join_requests;
CREATE POLICY "Users insert own join requests"
  ON public.company_join_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users view own join requests" ON public.company_join_requests;
CREATE POLICY "Users view own join requests"
  ON public.company_join_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Company admins view requests" ON public.company_join_requests;
CREATE POLICY "Company admins view requests"
  ON public.company_join_requests FOR SELECT TO authenticated
  USING (company_id = public.auth_company_id() AND public.is_company_admin());

DROP POLICY IF EXISTS "Company admins update requests" ON public.company_join_requests;
CREATE POLICY "Company admins update requests"
  ON public.company_join_requests FOR UPDATE TO authenticated
  USING (company_id = public.auth_company_id() AND public.is_company_admin());

DROP POLICY IF EXISTS "Super admins manage join requests" ON public.company_join_requests;
CREATE POLICY "Super admins manage join requests"
  ON public.company_join_requests FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- List companies for signup picker
CREATE OR REPLACE FUNCTION public.list_companies_for_signup()
RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name FROM public.companies ORDER BY name;
$$;

-- Request to join
CREATE OR REPLACE FUNCTION public.request_to_join_company(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_existing_company uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT company_id INTO v_existing_company FROM public.profiles WHERE id = auth.uid();
  IF v_existing_company IS NOT NULL THEN
    RAISE EXCEPTION 'You already belong to a company';
  END IF;

  INSERT INTO public.company_join_requests (company_id, user_id)
  VALUES (_company_id, auth.uid())
  ON CONFLICT (user_id, company_id) WHERE status = 'pending' DO NOTHING
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'status', 'pending');
END;
$$;

-- Approve
CREATE OR REPLACE FUNCTION public.approve_join_request(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req public.company_join_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.company_join_requests WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Request is not pending'; END IF;

  IF NOT (public.is_super_admin() OR (v_req.company_id = public.auth_company_id() AND public.is_company_admin())) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.profiles
    SET company_id = v_req.company_id,
        role = CASE WHEN role = 'super_admin' THEN role ELSE 'member'::app_role END,
        updated_at = now()
    WHERE id = v_req.user_id;

  UPDATE public.company_join_requests
    SET status = 'approved', decided_at = now(), decided_by = auth.uid()
    WHERE id = _id;

  RETURN jsonb_build_object('id', _id, 'status', 'approved');
END;
$$;

-- Reject
CREATE OR REPLACE FUNCTION public.reject_join_request(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req public.company_join_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.company_join_requests WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Request is not pending'; END IF;

  IF NOT (public.is_super_admin() OR (v_req.company_id = public.auth_company_id() AND public.is_company_admin())) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.company_join_requests
    SET status = 'rejected', decided_at = now(), decided_by = auth.uid()
    WHERE id = _id;

  RETURN jsonb_build_object('id', _id, 'status', 'rejected');
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_companies_for_signup() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.request_to_join_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_join_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_join_request(uuid) TO authenticated;
