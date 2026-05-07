-- Improved error message for invite mismatch
CREATE OR REPLACE FUNCTION public.accept_company_invite(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    RAISE EXCEPTION 'This invite was sent to % but you''re signed in as %. Sign out and sign in with the invited email, or ask your admin to update the invite.',
      v_invite.email, v_user_email;
  END IF;

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
$function$;

-- New: allow company admins to update a pending invite's email
CREATE OR REPLACE FUNCTION public.update_company_invite_email(_id uuid, _new_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite public.company_invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_invite FROM public.company_invites WHERE id = _id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite has already been accepted';
  END IF;

  IF NOT (public.is_super_admin() OR (v_invite.company_id = public.auth_company_id() AND public.is_company_admin())) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _new_email IS NULL OR length(trim(_new_email)) = 0 THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  UPDATE public.company_invites
  SET email = lower(trim(_new_email)),
      expires_at = now() + interval '14 days'
  WHERE id = _id
  RETURNING * INTO v_invite;

  RETURN jsonb_build_object(
    'id', v_invite.id,
    'email', v_invite.email,
    'token', v_invite.token,
    'expires_at', v_invite.expires_at
  );
END;
$function$;