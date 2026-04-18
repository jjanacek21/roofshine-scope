-- =====================================================
-- 1. company_invites table
-- =====================================================
CREATE TABLE public.company_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'member',
  invited_by uuid NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_company_invites_company ON public.company_invites(company_id);
CREATE INDEX idx_company_invites_email ON public.company_invites(lower(email));

ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;

-- Company admins manage invites for their company
CREATE POLICY "Company admins view invites"
ON public.company_invites FOR SELECT TO authenticated
USING (company_id = public.auth_company_id() AND public.is_company_admin());

CREATE POLICY "Company admins create invites"
ON public.company_invites FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.auth_company_id()
  AND public.is_company_admin()
  AND invited_by = auth.uid()
  AND role <> 'super_admin'
  AND role <> 'owner'  -- company admins cannot mint other owners
);

CREATE POLICY "Company admins delete invites"
ON public.company_invites FOR DELETE TO authenticated
USING (company_id = public.auth_company_id() AND public.is_company_admin());

CREATE POLICY "Super admins manage all invites"
ON public.company_invites FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- =====================================================
-- 2. Profiles RLS: company admins manage their team
-- =====================================================
CREATE POLICY "Company admins update team profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (
  company_id = public.auth_company_id()
  AND public.is_company_admin()
  AND id <> auth.uid()  -- self-update goes through "Update own profile"
)
WITH CHECK (
  company_id = public.auth_company_id()
  AND role <> 'super_admin'
  AND role <> 'owner'  -- can't promote to owner
);

-- =====================================================
-- 3. accept_company_invite RPC
-- =====================================================
CREATE OR REPLACE FUNCTION public.accept_company_invite(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.company_invites%ROWTYPE;
  v_user_email text;
  v_company_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_invite FROM public.company_invites WHERE token = _token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite token';
  END IF;

  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite has already been used';
  END IF;

  IF v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'Invite has expired';
  END IF;

  IF lower(v_invite.email) <> lower(v_user_email) THEN
    RAISE EXCEPTION 'Invite was sent to a different email address';
  END IF;

  -- Update profile (preserve super_admin if user happens to be one)
  UPDATE public.profiles
  SET company_id = v_invite.company_id,
      role = CASE WHEN role = 'super_admin' THEN role ELSE v_invite.role END,
      updated_at = now()
  WHERE id = auth.uid();

  UPDATE public.company_invites
  SET accepted_at = now()
  WHERE id = v_invite.id;

  SELECT name INTO v_company_name FROM public.companies WHERE id = v_invite.company_id;

  RETURN jsonb_build_object(
    'company_id', v_invite.company_id,
    'company_name', v_company_name,
    'role', v_invite.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_company_invite(text) TO authenticated;

-- =====================================================
-- 4. Helper: lookup invite preview by token (for UI before accepting)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_invite_preview(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.company_invites%ROWTYPE;
  v_company_name text;
BEGIN
  SELECT * INTO v_invite FROM public.company_invites WHERE token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;
  IF v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'already_accepted');
  END IF;
  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;
  SELECT name INTO v_company_name FROM public.companies WHERE id = v_invite.company_id;
  RETURN jsonb_build_object(
    'valid', true,
    'email', v_invite.email,
    'role', v_invite.role,
    'company_name', v_company_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_preview(text) TO authenticated, anon;